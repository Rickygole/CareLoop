import asyncio
import json
import os
import re
import secrets
import threading
import time
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import parse_qsl, urlencode
from xml.sax.saxutils import escape as xml_escape

from dotenv import load_dotenv
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Query,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware


load_dotenv()

import conversation
import telephony
import twilio_signature
from clinic import FRONT_DESK_DISCLOSURE, plan_clinic_call
from contradiction import (
    LIMITATIONS,
    active_ingredients,
    check_cross_call,
    check_regimen,
    patient_message,
)
import escalation
from escalation import (
    ESCALATION_ALERT_GOES_TO_ONE_PHONE,
    ESCALATION_IS_A_RECORD_ONLY,
    NEVER_CONTACTS_EMERGENCY_SERVICES,
    get_escalations,
    record_escalation,
    reset_escalations,
    unacknowledged_for_patient,
)
from memory import InMemoryBackend, summarize_episode
import followup
import portal
from providers import find_provider, specialties
from scheduler import build_day_plan, clinic_now
from responses import suggested_response
from triage_engine import CRISIS_RULES, Severity, detect_emergency, triage

app = FastAPI(
    title="CareLoop API",
    description="Medication adherence voice agent with two-tier symptom triage.",
    version="0.2.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(__file__).resolve().parent / "mock_data"
WEBHOOK_SECRET = os.environ.get("CARELOOP_WEBHOOK_SECRET", "")


def _wrong_secret(provided: Optional[str]) -> bool:
    import hmac

    return bool(WEBHOOK_SECRET) and not hmac.compare_digest(provided or "", WEBHOOK_SECRET)

SESSION_HEADER = "X-CareLoop-Session"
SESSION_QUERY_PARAM = "session_id"

TWILIO_VALIDATE_SIGNATURES_ENV = "TWILIO_VALIDATE_SIGNATURES"
TWILIO_SIGNATURE_HEADER = "X-Twilio-Signature"


def _twilio_signature_required() -> bool:
    return (os.environ.get(TWILIO_VALIDATE_SIGNATURES_ENV) or "").strip().lower() in (
        "1", "true", "yes",
    )


VERCEL_REWRITE_PATH_PARAM = "path"


def _external_query(request: Request) -> str:
    pairs = [
        (k, v)
        for k, v in parse_qsl(request.url.query, keep_blank_values=True)
        if k != VERCEL_REWRITE_PATH_PARAM
    ]
    return urlencode(pairs)


async def _verify_twilio_request(request: Request) -> None:
    if not _twilio_signature_required():
        return
    auth_token = (os.environ.get("TWILIO_AUTH_TOKEN") or "").strip()
    if not auth_token:
        return
    if request.method != "POST":
        raise HTTPException(403, "invalid_twilio_signature")
    raw_body = (await request.body()).decode("utf-8")
    fields = dict(parse_qsl(raw_body, keep_blank_values=True))
    signature = request.headers.get(TWILIO_SIGNATURE_HEADER, "")
    url = str(request.base_url).rstrip("/") + request.url.path
    query = _external_query(request)
    if query:
        url += "?" + query
    if not twilio_signature.valid_signature(auth_token, url, fields, signature):
        raise HTTPException(403, "invalid_twilio_signature")


@app.api_route("/debug/twilio_echo", methods=["GET", "POST"])
async def debug_twilio_echo(request: Request, secret: str = ""):
    if not WEBHOOK_SECRET or _wrong_secret(secret):
        raise HTTPException(404)
    raw_body = (await request.body()).decode("utf-8")
    fields = dict(parse_qsl(raw_body, keep_blank_values=True))
    url = str(request.base_url).rstrip("/") + request.url.path
    if request.url.query:
        url += "?" + request.url.query
    return {
        "reconstructed_url": url,
        "fields": fields,
        "has_signature_header": bool(request.headers.get(TWILIO_SIGNATURE_HEADER, "")),
        "host_header": request.headers.get("host", ""),
        "x_forwarded_proto": request.headers.get("x-forwarded-proto", ""),
        "x_forwarded_host": request.headers.get("x-forwarded-host", ""),
        "scope_scheme": request.scope.get("scheme"),
        "scope_root_path": request.scope.get("root_path"),
        "scope_path": request.scope.get("path"),
        "scope_server": request.scope.get("server"),
    }


SESSION_CAPACITY = 200
SESSION_IDLE_SECONDS = 1800
ANSWERED_CALL_CAPACITY = 64
CALLBACK_NONCE_CAPACITY = 64
CONSUMED_CALLBACK_CAPACITY = 64
SMS_MAX_CHARS = 320
SMS_MAX_NAME_CHARS = 24
MAX_DOSE_HOURS_PER_MEDICATION = 6


def _remember_bounded(store: Dict[str, bool], key: str, capacity: int) -> None:
    store.pop(key, None)
    store[key] = True
    while len(store) > capacity:
        store.pop(next(iter(store)))


def _anchor_history_to_today(patient: dict) -> None:
    from scheduler import clinic_now

    today = clinic_now().date().isoformat()
    for entry in patient.get("history", []):
        stamp = str(entry.get("timestamp", ""))
        if len(stamp) >= 10:
            entry["timestamp"] = today + stamp[10:]


def load_patients() -> Dict[str, dict]:
    with open(DATA_DIR / "patients.json") as f:
        patients = {p["patient_id"]: p for p in json.load(f)["patients"]}
    for patient in patients.values():
        _anchor_history_to_today(patient)
    return patients


BASELINE_PATIENTS = load_patients()


def derive_schedule(medication_requests: List[dict]) -> List[dict]:
    schedule = []
    for req in medication_requests:
        if req.get("status") != "active":
            continue
        for hour in req["timing"]["preferred_hours"]:
            schedule.append(
                {
                    "medication": req["medication"],
                    "dosage": req["dosage_text"],
                    "time": f"{hour:02d}:00",
                    "frequency": req["frequency"],
                    "prescriber": req["prescriber"],
                    "medication_id": req["medication_id"],
                }
            )
    return sorted(schedule, key=lambda d: d["time"])


EVENT_TYPES = {
    "CALL_INITIATED",
    "CALL_CONNECTED",
    "CALL_ENDED",
    "AGENT_SPEECH",
    "PATIENT_SPEECH",
    "TIER_0_CHECK",
    "TIER_0_MATCH",
    "NORMALIZE",
    "TIER_1_CLASSIFY",
    "ACTION_DECIDED",
    "TOOL_CALL",
    "BOOKING_CONFIRMED",
    "MEMORY_WRITE",
    "EMERGENCY_ESCALATION",
}


class TraceBus:

    def __init__(self, capacity: int = 500):
        self._events: List[dict] = []
        self._clients: List[WebSocket] = []
        self._capacity = capacity
        self._seq = 0
        self.boot_id = uuid.uuid4().hex[:12]

    def reset(self) -> None:
        self._events.clear()
        self._seq = 0
        self.boot_id = uuid.uuid4().hex[:12]

    async def emit(self, event_type: str, payload: Optional[dict] = None) -> dict:
        self._seq += 1
        event = {
            "seq": self._seq,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "payload": payload or {},
        }
        self._events.append(event)
        del self._events[: -self._capacity]

        for client in list(self._clients):
            try:
                await client.send_json(event)
            except Exception:
                self.disconnect(client)
        return event

    @property
    def current_seq(self) -> int:
        return self._seq

    def since(self, seq: int) -> List[dict]:
        return [e for e in self._events if e["seq"] > seq]

    def connect(self, ws: WebSocket) -> None:
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)


class SessionState:

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.patients: Dict[str, dict] = deepcopy(BASELINE_PATIENTS)
        for patient in self.patients.values():
            _anchor_history_to_today(patient)
        self.memory = InMemoryBackend()
        self.escalations: Dict[str, List[dict]] = {}
        self.regimen_snapshots: Dict[str, List[dict]] = {}
        self.bookings: Dict[str, List[dict]] = {}
        self.pending_bookings: Dict[str, dict] = {}
        self.conversations: Dict[str, List[dict]] = {}
        self.answered_calls: Dict[str, bool] = {}
        self.callback_nonces: Dict[str, bool] = {}
        self.consumed_callbacks: Dict[str, bool] = {}
        self.call_state: Dict[str, dict] = {}
        self.bus = TraceBus()
        self.call_limiter = telephony.CallLimiter()
        self.escalation_limiter = telephony.CallLimiter()
        self.last_touched = time.monotonic()


class SessionManager:

    def __init__(self, capacity: int = SESSION_CAPACITY, idle_seconds: int = SESSION_IDLE_SECONDS):
        self._sessions: Dict[str, SessionState] = {}
        self._capacity = capacity
        self._idle_seconds = idle_seconds
        self._lock = threading.Lock()

    def _evict_idle(self) -> None:
        now = time.monotonic()
        stale = [
            sid for sid, state in self._sessions.items()
            if now - state.last_touched > self._idle_seconds
        ]
        for sid in stale:
            self._sessions.pop(sid, None)

    def _evict_oldest(self) -> None:
        if not self._sessions:
            return
        oldest_id = min(self._sessions, key=lambda sid: self._sessions[sid].last_touched)
        self._sessions.pop(oldest_id, None)

    def get(self, session_id: str) -> SessionState:
        with self._lock:
            self._evict_idle()
            state = self._sessions.get(session_id)
            if state is None:
                if len(self._sessions) >= self._capacity:
                    self._evict_oldest()
                state = SessionState(session_id)
                self._sessions[session_id] = state
            state.last_touched = time.monotonic()
            return state

    def reset(self, session_id: str) -> SessionState:
        with self._lock:
            self._sessions.pop(session_id, None)
        return self.get(session_id)


SESSIONS = SessionManager()


def _fallback_session_id(client) -> str:
    host = client.host if client else "anonymous"
    return f"auto:{host}"


def get_session(request: Request, response: Response) -> SessionState:
    session_id = request.headers.get(SESSION_HEADER) or request.query_params.get(SESSION_QUERY_PARAM)
    if not session_id:
        session_id = _fallback_session_id(request.client)
    session = SESSIONS.get(session_id)
    response.headers[SESSION_HEADER] = session.session_id
    return session


@app.websocket("/trace")
async def trace_socket(
    ws: WebSocket,
    token: str = Query(default=""),
    session_id: str = Query(default=""),
):
    if _wrong_secret(token):
        await ws.close(code=1008)
        return

    resolved_id = ws.headers.get(SESSION_HEADER) or session_id or _fallback_session_id(ws.client)
    session = SESSIONS.get(resolved_id)

    await ws.accept()
    session.bus.connect(ws)
    try:
        for event in session.bus.since(0):
            await ws.send_json(event)
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"event_type": "PING", "payload": {}})
    except WebSocketDisconnect:
        session.bus.disconnect(ws)
    except Exception:
        session.bus.disconnect(ws)


@app.get("/trace/events")
def trace_events(
    since: int = 0,
    token: str = Query(default=""),
    session: SessionState = Depends(get_session),
):
    if _wrong_secret(token):
        raise HTTPException(403, "unauthorized")
    return {"events": session.bus.since(since), "boot_id": session.bus.boot_id}


class ResetRequest(BaseModel):
    secret: Optional[str] = None


@app.post("/admin/reset")
async def admin_reset(body: ResetRequest, session: SessionState = Depends(get_session)):
    if _wrong_secret(body.secret):
        raise HTTPException(401, "unauthorized")
    fresh = SESSIONS.reset(session.session_id)
    return {"reset": True, "boot_id": fresh.bus.boot_id, "patients_loaded": len(fresh.patients)}


class ConnectRequest(BaseModel):
    patient_id: str = Field(..., examples=["p1"])


@app.post("/portal/connect")
async def portal_connect(body: ConnectRequest, session: SessionState = Depends(get_session)):
    patient = session.patients.get(body.patient_id)
    if patient is None:
        raise HTTPException(404, f"No patient with id {body.patient_id!r}")

    patient = dict(patient)
    patient["connected"] = True
    patient["connected_at"] = datetime.now(timezone.utc).isoformat()
    session.patients[body.patient_id] = patient

    return {
        "patient": patient,
        "derived_schedule": derive_schedule(patient["medication_requests"]),
    }


class TriageRequest(BaseModel):
    transcript: str = Field(..., examples=["my chest is killing me"])
    patient_id: Optional[str] = None


def _source_for(result) -> str:
    if result.tier == "tier_0":
        return "rule"
    if result.llm_severity is None:
        return "fallback_error"
    return "llm"


async def run_triage(session: SessionState, transcript: str, patient_id: Optional[str] = None) -> dict:
    await session.bus.emit("PATIENT_SPEECH", {"text": transcript, "patient_id": patient_id})
    await session.bus.emit("TIER_0_CHECK", {"transcript": transcript})

    result = await _offload(triage, transcript)

    if result.matched_rules:
        await session.bus.emit("TIER_0_MATCH", {"rules": result.matched_rules})
    if result.normalized_text:
        await session.bus.emit("NORMALIZE", {"normalized_text": result.normalized_text})
    if result.tier == "tier_1":
        await session.bus.emit(
            "TIER_1_CLASSIFY",
            {
                "severity": result.severity.label,
                "confidence": result.confidence,
                "source": _source_for(result),
            },
        )

    payload = {
        "tier": result.severity.label.lower(),
        "source": _source_for(result),
        "normalized_text": result.normalized_text,
        "confidence": result.confidence,
        "reasoning": result.reasoning,
        "suggested_agent_response": suggested_response(result.severity, result.is_crisis),
        "is_crisis": result.is_crisis,
        "is_emergency": result.is_emergency,
        "matched_rules": result.matched_rules,
        "patient_id": patient_id,
        "transcript": transcript,
    }

    if result.is_emergency:
        await session.bus.emit(
            "EMERGENCY_ESCALATION",
            {
                "rules": result.matched_rules,
                "is_crisis": result.is_crisis,
            },
        )
    await session.bus.emit("ACTION_DECIDED", {"tier": payload["tier"]})
    return payload


class PortalSyncRequest(BaseModel):
    patient_id: str = Field(..., examples=["p1"])
    accept_portal_changes: bool = False


@app.post("/portal/sync")
async def portal_sync(body: PortalSyncRequest, session: SessionState = Depends(get_session)):
    patient = session.patients.get(body.patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    previous = session.regimen_snapshots.get(body.patient_id)
    before_hash = regimen_hash(patient["medication_requests"]) if previous else None

    arriving = portal.apply_portal_changes(patient) if body.accept_portal_changes else []

    current = patient["medication_requests"]
    diff = portal.diff_regimen(previous, current)
    session.regimen_snapshots[body.patient_id] = deepcopy(current)

    synced_at = datetime.now(timezone.utc).isoformat()
    patient["connected"] = True
    patient["connected_at"] = patient.get("connected_at") or synced_at
    patient["last_synced_at"] = synced_at

    regimen = evaluate_regimen(patient)
    plan = build_day_plan(patient)

    await session.bus.emit("PORTAL_SYNC", {
        "patient_id": body.patient_id,
        "source": portal.PORTAL_NAME,
        "resources": len(current) + len(patient.get("allergies", [])) + 1,
        "changed": diff["changed"],
    })

    if diff["changed"] or diff["first_sync"]:
        await session.bus.emit("REGIMEN_SNAPSHOT", {
            "patient_id": body.patient_id,
            "previous_hash": before_hash,
            "content_hash": regimen["content_hash"],
            "added": [r.get("medication") for r in diff["added"]],
            "removed": [r.get("medication") for r in diff["removed"]],
        })
        await session.bus.emit("SCHEDULE_RECOMPUTED", {
            "patient_id": body.patient_id,
            "doses_total": plan["doses_total"],
            "next_dose": plan["next_dose"]["time"] if plan["next_dose"] else None,
        })
        for finding in regimen["surfaced"]:
            await session.bus.emit("CONTRADICTION_FLAGGED", {
                "ingredients": finding["ingredients"],
                "severity": finding["severity"],
                "concern": finding["concern"],
                "source": finding["source"],
            })

    return {
        "patient_id": body.patient_id,
        "synced_at": synced_at,
        "source": portal.PORTAL_NAME,
        "shared": portal.SHARED_CATEGORIES,
        "bundle": portal.build_bundle(patient, synced_at),
        "medications": current,
        "allergies": patient.get("allergies", []),
        "preferred_contact_window": patient.get("preferred_contact_window"),
        "schedule": plan,
        "regimen": regimen,
        "diff": diff,
        "diff_summary": portal.describe_diff(diff),
        "portal_has_pending_change": bool(patient.get("portal_pending")),
        "applied": [r.get("medication") for r in arriving],
        "limitations": portal.LIMITATIONS,
    }


@app.post("/triage")
async def triage_transcript(body: TriageRequest, session: SessionState = Depends(get_session)):
    start = session.bus.current_seq
    result = await run_triage(session, body.transcript, body.patient_id)
    result["events"] = session.bus.since(start)
    return result


URGENCIES = {"routine", "urgent"}


class BookRequest(BaseModel):
    specialty: str = Field(..., examples=["Internal Medicine"])
    urgency: str = Field("routine", examples=["routine"])
    patient_id: Optional[str] = None


@app.post("/book")
async def book_appointment(body: BookRequest, session: SessionState = Depends(get_session)):
    urgency = body.urgency.strip().lower()
    if urgency not in URGENCIES:
        raise HTTPException(400, f"urgency must be one of {sorted(URGENCIES)}")

    patient = session.patients.get(body.patient_id) if body.patient_id else None
    payer = patient["insurance_payer_id"] if patient else None

    provider = find_provider(body.specialty, payer)
    if provider is None:
        raise HTTPException(
            404,
            f"No in-network provider for {body.specialty!r}. Available: {specialties()}",
        )
    if not provider["available_slots"]:
        raise HTTPException(
            409, f"{provider['name']} has no bookable slots. Emergencies are not booked."
        )

    slot = provider["available_slots"][0]
    await session.bus.emit(
        "BOOKING_CONFIRMED",
        {
            "provider_name": provider["name"],
            "time": slot,
            "specialty": provider["specialty"],
        },
    )
    return {
        "confirmed": True,
        "provider_name": provider["name"],
        "time": slot,
        "specialty": provider["specialty"],
    }


class ToolCall(BaseModel):
    tool_name: str
    patient_id: Optional[str] = None
    transcript: Optional[str] = None
    specialty: Optional[str] = None
    urgency: Optional[str] = None
    secret: Optional[str] = None


@app.post("/webhook/elevenlabs")
async def elevenlabs_webhook(body: ToolCall, session: SessionState = Depends(get_session)):
    if _wrong_secret(body.secret):
        raise HTTPException(401, "unauthorized")

    if body.patient_id and body.patient_id not in session.patients:
        raise HTTPException(404, "unknown_patient")

    await session.bus.emit("TOOL_CALL", {"tool": body.tool_name, "patient_id": body.patient_id})

    if body.tool_name == "report_symptom":
        return await run_triage(session, body.transcript or "", body.patient_id)

    if body.tool_name == "book_appointment":
        if (
            body.transcript is not None
            and not _confirms_appointment(body.transcript)
            and not _requests_appointment(body.transcript)
        ):
            raise HTTPException(
                422,
                "book_appointment was called without the patient clearly agreeing. "
                "Ask again and only call this tool once they say yes.",
            )
        return await book_appointment(
            BookRequest(
                specialty=body.specialty or "Internal Medicine",
                urgency=body.urgency or "routine",
                patient_id=body.patient_id,
            ),
            session=session,
        )

    raise HTTPException(400, f"unknown tool {body.tool_name!r}")


async def _maybe_alert_provider(
    session: SessionState, patient: dict, escalation_record: dict, transcript: str,
) -> None:
    kind = escalation_record["kind"]
    if not escalation.wants_alert(kind):
        return
    phone = escalation.alert_phone()
    if not phone:
        escalation_record["notification_transport"] = "no_alert_phone_configured"
        return

    provider = escalation.assigned_provider(patient)

    if not session.escalation_limiter.allow():
        escalation_record["notification_transport"] = "sms_rate_limited"
        escalation_record["alert_sms"] = {
            "ok": False, "sid": None, "error": "rate_limited",
            "provider_name": provider["name"], "provider_id": provider["provider_id"],
        }
        return

    fired_at = datetime.now(timezone.utc)
    message = escalation.compose_alert(
        patient.get("name", "the patient"), provider["name"], kind, transcript, fired_at,
    )
    result = await _offload(telephony.send_sms, phone, message)
    session.escalation_limiter.record()

    escalation_record["notification_transport"] = "sms"
    escalation_record["notification_delivered"] = bool(result.get("ok"))
    escalation_record["alert_sms"] = {
        "ok": result.get("ok"),
        "sid": result.get("sid"),
        "error": result.get("error"),
        "provider_name": provider["name"],
        "provider_id": provider["provider_id"],
    }


def _escalation_headline(escalation_record: dict, provider_name: Optional[str]) -> str:
    if escalation_record.get("alert_sms") is None:
        return ""
    if escalation_record["notification_delivered"]:
        return f"ESCALATED, {provider_name} notified"
    return f"ESCALATION ALERT FAILED, {provider_name} not reached"


class RunLoopRequest(BaseModel):
    patient_id: str
    transcript: str
    auto_book: bool = True
    call_clinic: bool = False


@app.post("/loop/run")
async def run_loop(
    body: RunLoopRequest, request: Request, session: SessionState = Depends(get_session),
):
    patient = session.patients.get(body.patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    start = session.bus.current_seq
    plan = build_day_plan(patient)
    await session.bus.emit("CALL_INITIATED", {
        "patient_id": body.patient_id, "patient": patient["name"],
    })
    if plan["next_dose"]:
        await session.bus.emit("REMINDER_DUE", {
            "medication": plan["next_dose"]["medication"],
            "dosage": plan["next_dose"]["dosage"],
            "time": plan["next_dose"]["time"],
            "status": plan["next_dose"]["status"],
        })
    await session.bus.emit("CALL_CONNECTED", {"patient_id": body.patient_id})

    history = session.memory.get_history(body.patient_id)
    prior_episode = history[-1] if history else None

    result = await run_triage(session, body.transcript, body.patient_id)

    if not result["is_crisis"] and not result["is_emergency"]:
        noted = _record_dose_taken(session, body.patient_id, body.transcript)
        if noted:
            await session.bus.emit("DOSE_CONFIRMED", {
                "patient_id": body.patient_id,
                "medication_id": noted["medication_id"],
                "at": noted["timestamp"],
            })

    cross_call_findings = check_cross_call(body.transcript, prior_episode)
    for finding in cross_call_findings:
        if finding["surfaced"]:
            await session.bus.emit("CONTRADICTION_FLAGGED", {
                "check_id": finding["check_id"],
                "severity": finding["severity"],
                "concern": finding["concern"],
                "source": finding["source"],
            })

    booking = None
    booking_offered = False
    call = None
    pending = session.pending_bookings.get(body.patient_id)

    if pending and not pending.get("proposed") and _confirms_appointment(body.transcript):
        proposed_call = _propose_slot(patient, pending)
        if proposed_call is None:
            session.pending_bookings.pop(body.patient_id, None)
            result["suggested_agent_response"] = (
                BOOKING_NO_TIME_WORKS + " " + result["suggested_agent_response"]
            )
        else:
            await session.bus.emit("BOOKING_PROPOSED", {
                "patient_id": body.patient_id,
                "provider_name": proposed_call["provider"]["name"],
                "time": proposed_call["slot"],
            })
            result["suggested_agent_response"] = (
                _propose_message(proposed_call, pending["offer_count"] == 1)
                + " " + result["suggested_agent_response"]
            )
    elif pending and pending.get("proposed") and _confirms_appointment(body.transcript):
        session.pending_bookings.pop(body.patient_id, None)
        specialty = pending["specialty"]
        call = plan_clinic_call(
            specialty,
            patient["insurance_payer_id"],
            patient.get("insurance_display_name", "their insurer"),
            patient["name"],
            pending["tier"],
            pending["transcript"],
            exclude=_rejected_slot_keys(pending),
        )
        if not call:
            result["suggested_agent_response"] = (
                "I could not find an opening right now, so please call the "
                "clinic yourself. " + result["suggested_agent_response"]
            )
    elif pending and pending.get("proposed") and _wants_different_time(body.transcript):
        _reject_proposed_slot(pending)
        proposed_call = _propose_slot(patient, pending)
        if proposed_call is None:
            session.pending_bookings.pop(body.patient_id, None)
            result["suggested_agent_response"] = (
                BOOKING_NO_TIME_WORKS + " " + result["suggested_agent_response"]
            )
        else:
            await session.bus.emit("BOOKING_PROPOSED", {
                "patient_id": body.patient_id,
                "provider_name": proposed_call["provider"]["name"],
                "time": proposed_call["slot"],
            })
            result["suggested_agent_response"] = (
                _propose_message(proposed_call, False)
                + " " + result["suggested_agent_response"]
            )
    elif pending and _declines_appointment(body.transcript):
        session.pending_bookings.pop(body.patient_id, None)
        await session.bus.emit("BOOKING_DECLINED", {"patient_id": body.patient_id})
        result["suggested_agent_response"] = (
            "No problem, I will not book anything. " + result["suggested_agent_response"]
        )
    elif (
        pending is None
        and not result["is_emergency"]
        and _requests_appointment(body.transcript)
    ):
        specialty = "Internal Medicine"
        call = plan_clinic_call(
            specialty,
            patient["insurance_payer_id"],
            patient.get("insurance_display_name", "their insurer"),
            patient["name"],
            result["tier"],
            body.transcript,
        )
        if not call:
            result["suggested_agent_response"] = (
                "I could not find an opening right now, so please call the "
                "clinic yourself. " + result["suggested_agent_response"]
            )
    elif body.auto_book and result["tier"] in ("moderate", "severe") and not result["is_emergency"]:
        specialty = "Internal Medicine"
        session.pending_bookings[body.patient_id] = {
            "specialty": specialty,
            "tier": result["tier"],
            "transcript": body.transcript,
            "proposed": None,
            "rejected_slots": [],
            "offer_count": 0,
        }
        booking_offered = True
        await session.bus.emit("BOOKING_OFFERED", {
            "patient_id": body.patient_id, "specialty": specialty,
        })

    if call:
        await session.bus.emit("CLINIC_CALL_INITIATED", {
            "provider": call["provider"]["name"],
            "specialty": call["provider"]["specialty"],
            "simulated": call["simulated"],
            "disclosure": call["disclosure"],
        })
        for turn in call["turns"]:
            event = "CLINIC_AGENT_SPEECH" if turn["speaker"] == "careloop" else "CLINIC_DESK_SPEECH"
            await session.bus.emit(event, {"text": turn["text"]})
        await session.bus.emit("CLINIC_CALL_ENDED", {"booked": True})
        await session.bus.emit("BOOKING_CONFIRMED", {
            "provider_name": call["provider"]["name"],
            "time": call["slot"],
            "specialty": call["provider"]["specialty"],
        })
        booking = {
            "confirmed": True,
            "provider_name": call["provider"]["name"],
            "time": call["slot"],
            "specialty": call["provider"]["specialty"],
            "simulated_front_desk": call["simulated"],
            "disclosure": call["disclosure"],
            "turns": call["turns"],
        }
        _remember_booking(session, body.patient_id, booking, body.transcript)
        await session.bus.emit("PATIENT_CONFIRMED", {
            "text": (
                "This is a simulated booking. In a real deployment you would "
                f"now be booked with {call['provider']['name']} at "
                f"{call['slot']}. No real clinic was contacted and no "
                "appointment exists."
            ),
        })

        missing = telephony.missing_env_vars()
        if not body.call_clinic:
            await session.bus.emit("PHONE_CALL_NOT_PLACED", {
                "leg": "clinic",
                "reason": "not_requested",
                "detail": "The booking ran. No telephone was dialled, because this run did not ask for one.",
            })
        elif missing:
            await session.bus.emit("PHONE_CALL_NOT_CONFIGURED", {
                "leg": "clinic", "missing": missing,
            })
        elif not session.call_limiter.allow():
            await session.bus.emit("PHONE_CALL_NOT_CONFIGURED", {
                "leg": "clinic", "reason": "rate_limited",
            })
        else:
            params = {
                "specialty": specialty,
                "payer_id": patient["insurance_payer_id"] or "",
                "payer_display": patient.get("insurance_display_name", "their insurer"),
                "patient_name": patient["name"],
                "tier": result["tier"],
                "transcript": body.transcript,
                SESSION_QUERY_PARAM: session.session_id,
            }
            base_url = str(request.base_url).rstrip("/")
            twiml_url = base_url + "/voice/clinic?" + urlencode(params)
            to = telephony.demo_phone_number()
            dial_result = await _offload(telephony.place_call, to, twiml_url=twiml_url)
            session.call_limiter.record()
            await _emit_call_result(session, "clinic", to, dial_result)

    now = datetime.now(timezone.utc)
    escalation_record = record_escalation(
        body.patient_id, result["tier"], result["is_crisis"], now, store=session.escalations,
    )
    if escalation_record:
        provider = escalation.assigned_provider(patient)
        await _maybe_alert_provider(session, patient, escalation_record, body.transcript)
        await session.bus.emit("ESCALATION_FIRED", {
            "kind": escalation_record["kind"],
            "would_notify": escalation_record["would_notify"],
            "notification_delivered": escalation_record["notification_delivered"],
            "ack_window_would_expire_at": escalation_record["ack_window_would_expire_at"],
            "provider_name": provider["name"],
            "headline": _escalation_headline(escalation_record, provider["name"]),
        })

    action_taken = "booked_appointment" if booking else (
        "escalated" if escalation_record else "logged"
    )
    episode = {
        "call_id": uuid.uuid4().hex,
        "timestamp": now.isoformat(),
        "transcript": body.transcript,
        "tier": result["tier"],
        "action_taken": action_taken,
        "summary": summarize_episode(body.transcript, result["tier"], action_taken),
        "is_crisis": result["is_crisis"],
    }
    session.memory.append_episode(body.patient_id, episode)

    await session.bus.emit("MEMORY_WRITE", {
        "patient_id": body.patient_id, "tier": result["tier"],
    })
    await session.bus.emit("CALL_ENDED", {"patient_id": body.patient_id})

    return {
        "triage": result,
        "plan": plan,
        "booking": booking,
        "booking_offered": booking_offered,
        "booking_pending": body.patient_id in session.pending_bookings,
        "prior_episode": prior_episode,
        "cross_call_findings": cross_call_findings,
        "escalation": escalation_record,
        "unacknowledged_escalations": unacknowledged_for_patient(
            body.patient_id, now, store=session.escalations,
        ),
        "escalation_is_a_record_only": ESCALATION_IS_A_RECORD_ONLY,
        "escalation_alert_disclosure": ESCALATION_ALERT_GOES_TO_ONE_PHONE,
        "safety_statement": NEVER_CONTACTS_EMERGENCY_SERVICES,
        "events": session.bus.since(start),
        "boot_id": session.bus.boot_id,
    }


@app.get("/schedule/{patient_id}")
def patient_schedule(patient_id: str, session: SessionState = Depends(get_session)):
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")
    return build_day_plan(patient)


@app.get("/escalations/{patient_id}")
def patient_escalations(patient_id: str, session: SessionState = Depends(get_session)):
    if patient_id not in session.patients:
        raise HTTPException(404, "unknown_patient")
    return {
        "patient_id": patient_id,
        "escalations": get_escalations(patient_id, store=session.escalations),
        "escalation_is_a_record_only": ESCALATION_IS_A_RECORD_ONLY,
        "escalation_alert_disclosure": ESCALATION_ALERT_GOES_TO_ONE_PHONE,
        "safety_statement": NEVER_CONTACTS_EMERGENCY_SERVICES,
    }


EXPECTED_ENV_KEYS = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "CARELOOP_WEBHOOK_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "DEMO_PHONE_NUMBER",
]


class AddMedicationRequest(BaseModel):
    patient_id: str
    medication: str
    dosage_text: str = ""
    frequency: str = "once daily"
    preferred_hours: List[int] = [8]
    prescriber: str = "Portal import"


def regimen_hash(medication_requests: List[dict]) -> str:
    import hashlib

    basis = "|".join(sorted(
        f"{m.get('medication')}::{m.get('dosage_text')}::{m.get('frequency')}"
        for m in medication_requests if m.get("status") == "active"
    ))
    return hashlib.sha256(basis.encode()).hexdigest()[:12]


def evaluate_regimen(patient: dict) -> dict:
    findings = check_regimen(patient["medication_requests"])
    surfaced = [f for f in findings if f["surfaced"]]
    return {
        "content_hash": regimen_hash(patient["medication_requests"]),
        "findings": findings,
        "surfaced": surfaced,
        "patient_message": patient_message(surfaced[0]) if surfaced else None,
        "limitations": LIMITATIONS,
    }


@app.get("/regimen/{patient_id}")
def regimen_state(patient_id: str, session: SessionState = Depends(get_session)):
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")
    return {
        "patient_id": patient_id,
        "medications": patient["medication_requests"],
        "schedule": build_day_plan(patient),
        "regimen": evaluate_regimen(patient),
    }


@app.post("/meds")
async def add_medication(body: AddMedicationRequest, session: SessionState = Depends(get_session)):
    patient = session.patients.get(body.patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    hours = list(body.preferred_hours or [8])
    if len(hours) > MAX_DOSE_HOURS_PER_MEDICATION or any(
        not isinstance(hour, int) or hour < 0 or hour > 23 for hour in hours
    ):
        raise HTTPException(
            400,
            "preferred_hours must be at most "
            f"{MAX_DOSE_HOURS_PER_MEDICATION} whole hours between 0 and 23",
        )

    before_hash = regimen_hash(patient["medication_requests"])
    new_id = f"med-{len(patient['medication_requests']) + 1}-{body.patient_id}"
    patient["medication_requests"] = patient["medication_requests"] + [{
        "medication_id": new_id,
        "medication": body.medication,
        "dosage_text": body.dosage_text,
        "frequency": body.frequency,
        "timing": {"times_per_day": len(hours), "preferred_hours": hours},
        "prescriber": body.prescriber,
        "status": "active",
        "start_date": datetime.now(timezone.utc).date().isoformat(),
    }]

    regimen = evaluate_regimen(patient)
    plan = build_day_plan(patient)

    await session.bus.emit("REGIMEN_SNAPSHOT", {
        "patient_id": body.patient_id,
        "previous_hash": before_hash,
        "content_hash": regimen["content_hash"],
        "medication_added": body.medication,
    })
    await session.bus.emit("SCHEDULE_RECOMPUTED", {
        "patient_id": body.patient_id,
        "doses_total": plan["doses_total"],
        "next_dose": plan["next_dose"]["time"] if plan["next_dose"] else None,
    })
    for finding in regimen["surfaced"]:
        await session.bus.emit("CONTRADICTION_FLAGGED", {
            "ingredients": finding["ingredients"],
            "severity": finding["severity"],
            "concern": finding["concern"],
            "source": finding["source"],
        })

    return {
        "added": True,
        "medication_id": new_id,
        "medications": patient["medication_requests"],
        "schedule": plan,
        "regimen": regimen,
    }


DEFAULT_DEMO_PATIENT_ID = "p1"

CHECKIN_GREETING = (
    "Hello {patient_first_name}. This is CareLoop, your medication assistant. "
    "Quick note before we start. I am an automated assistant, not a medical "
    "professional, and this is a demonstration."
)

CHECKIN_DOSE_PROMPT = (
    "{patient_first_name}, how have you been feeling? And separately, this "
    "is a reminder about your {medication}{indication}, {when}. {take}"
    "Tell me how you are doing, and let me know once you have taken it."
)

DOSE_TAKE_NOW = "Please take it now if you have not already. "
DOSE_TAKE_LATER = ""

CHECKIN_DOSE_PROMPT_FLAGGED = (
    "{patient_first_name}, how have you been feeling? Separately, your "
    "prescriber's schedule has your {medication} {when}. I am not going to "
    "ask you to take it, because something on your medication list is worth "
    "asking your prescriber or pharmacist about first. Please do not start, "
    "stop or change anything because of this call. Tell me how you are doing."
)

CHECKIN_NO_ANSWER = (
    "I did not hear anything, so I have made a note of this call. Please "
    "remember to take your {medication}. Goodbye for now."
)

CHECKIN_NO_ANSWER_FLAGGED = (
    "I did not hear anything, so I have made a note of this call. I am not "
    "asking you to take your {medication} right now, because something on "
    "your medication list is worth asking your prescriber or pharmacist "
    "about first. Please do not start, stop or change anything because of "
    "this call. Goodbye for now."
)

CHECKIN_SMS = (
    "Hi {patient_first_name}, this is CareLoop. We could not reach you by "
    "phone. This is a reminder to take your {medication}. Automated message "
    "from a demonstration service, not medical advice. If you feel unwell, "
    "contact your prescriber. In an emergency call 911."
)

CHECKIN_SMS_FLAGGED = (
    "CareLoop here, {patient_first_name}. We could not reach you by phone. "
    "Your {medication} is due, but something on your medication list is worth "
    "asking your prescriber or pharmacist about first. Please do not start, "
    "stop or change anything because of this message. In an emergency call 911."
)

CHECKIN_CLOSING = (
    "Thank you, {patient_first_name}. I have made a note of that on your "
    "record. Please keep taking your medication as your prescriber directed. "
    "I will check in with you again. Take care."
)

CHECKIN_CRISIS_HOLD = (
    "I am staying on the line with you. I am not going to hang up. If you can, "
    "please call or text 988 now, and stay with me until someone is with you."
)

CHECKIN_EMERGENCY_CLOSING = (
    "Please do that now. I am ending this call so your line is free."
)

CHECKIN_TRIAGE_UNAVAILABLE = (
    "Thank you. I could not finish checking that just now, so I have not "
    "made a note of it. If you feel unwell, please contact your prescriber. "
    "In an emergency call 911. Goodbye for now."
)

MAX_CALL_ATTEMPTS = 3
ANSWERED_CALL_SECONDS = 22

CLINIC_CALL_SELF_IDENTIFICATION = (
    "This is an automated call placed by CareLoop, a medication check-in "
    "assistant."
)

CARELOOP_VOICE = "Polly.Matthew"
CLINIC_VOICE = "Polly.Joanna"


def _twiml(inner: str) -> Response:
    body = f'<?xml version="1.0" encoding="UTF-8"?><Response>{inner}</Response>'
    return Response(content=body, media_type="application/xml")


def _say(text: str, voice: str = CARELOOP_VOICE) -> str:
    return f'<Say voice="{voice}">{xml_escape(text)}</Say>'


def _demo_medication_name(patient: dict) -> str:
    plan = build_day_plan(patient)
    if plan["next_dose"]:
        return plan["next_dose"]["medication"]
    active = [m for m in patient["medication_requests"] if m.get("status") == "active"]
    return active[0]["medication"] if active else "your medication"


SPOKEN_MAX_CHARS = 90


def _clamp_spoken(text: str) -> str:
    collapsed = " ".join(str(text or "").split())
    return collapsed[:SPOKEN_MAX_CHARS].rstrip() if len(collapsed) > SPOKEN_MAX_CHARS else collapsed


def _spoken_medication(patient: Optional[dict]) -> str:
    if not patient:
        return "your medication"
    plan = build_day_plan(patient)
    dose = plan["next_dose"]
    if dose:
        dosage = _spell_dosage(dose.get("dosage"))
        named = f"{dose['medication']}, {dosage}" if dosage else dose["medication"]
        return _clamp_spoken(named)
    return _clamp_spoken(_demo_medication_name(patient))


def _spell_dosage(dosage: Optional[str]) -> str:
    text = (dosage or "").strip()
    if not text:
        return ""
    for short, spoken in (("mcg", " micrograms"), ("mg", " milligrams"), ("ml", " millilitres")):
        if text.lower().endswith(short):
            return text[: -len(short)].strip() + spoken
    return text


def _first_name(patient: Optional[dict]) -> str:
    return patient["name"].split()[0] if patient else "there"


def _spoken_indication(patient: Optional[dict]) -> str:
    if not patient:
        return ""
    plan = build_day_plan(patient)
    dose = plan["next_dose"]
    wanted = (dose or {}).get("medication_id")
    for request in patient["medication_requests"]:
        if request.get("status") != "active":
            continue
        if wanted and request.get("medication_id") != wanted:
            continue
        return _clamp_spoken(request.get("indication"))
    return ""


def _dose_timing(patient: Optional[dict]) -> tuple:
    if not patient:
        return "due today", False
    dose = build_day_plan(patient)["next_dose"]
    if not dose:
        return "due today", False
    spoken = datetime.strptime(dose["time"], "%H:%M").strftime("%-I %p").lower()
    if dose["status"] in ("due_now", "due_soon"):
        return "due at about this time", True
    if dose["status"] == "missed":
        return f"was due earlier today, around {spoken}", False
    return f"due later today, at {spoken}", False


def _next_dose_is_flagged(patient: Optional[dict]) -> Optional[List[str]]:
    if not patient:
        return None
    surfaced = [
        f for f in check_regimen(patient["medication_requests"])
        if f["surfaced"] and f["severity"] in {"major", "contraindicated"}
    ]
    if not surfaced:
        return None
    return surfaced[0]["ingredients"]


def _telephony_not_configured(missing: List[str]) -> dict:
    return {
        "configured": False,
        "call_sid": None,
        "missing_env": missing,
        "detail": "Telephony is not configured. Set " + ", ".join(missing) + " to enable outbound calls.",
    }


CALL_PHASE_DIALLING = "dialling"
CALL_PHASE_RINGING = "ringing"
CALL_PHASE_ANSWERED = "answered"
CALL_PHASE_DISCONNECTED = "disconnected"
CALL_PHASE_REDIALLING = "redialling"
CALL_PHASE_TEXTED = "texted"
CALL_PHASE_ENDED = "ended"
CALL_PHASE_GAVE_UP = "gave_up"

CALL_PHASE_WORDING = {
    CALL_PHASE_RINGING: "Your phone is ringing now.",
    CALL_PHASE_ANSWERED: "You are on the call with CareLoop.",
    CALL_PHASE_DISCONNECTED: "The call was disconnected before the check-in finished.",
    CALL_PHASE_REDIALLING: "That call did not go through. CareLoop is ringing you again now.",
    CALL_PHASE_ENDED: "The check-in is finished.",
    CALL_PHASE_GAVE_UP: "CareLoop could not reach you, and the text did not send either.",
    CALL_PHASE_TEXTED: "You did not pick up, so CareLoop has sent you a text instead.",
}


CONVERSATION_HISTORY_LIMIT = 24

CONVERSATION_GOODBYE = "I will let you go for now."


def _conversation_context(patient: dict) -> str:
    plan = build_day_plan(patient)
    return conversation.build_context(
        patient, plan["next_dose"], _next_dose_is_flagged(patient),
    )


def _checkin_opener(patient: dict) -> str:
    first_name = _first_name(patient)
    medication = _spoken_medication(patient)
    indication = _spoken_indication(patient)
    flagged = _next_dose_is_flagged(patient)
    when_phrase, due_now = _dose_timing(patient)
    if flagged:
        return CHECKIN_DOSE_PROMPT_FLAGGED.format(
            patient_first_name=first_name,
            medication=medication,
            when=when_phrase,
        )
    return CHECKIN_DOSE_PROMPT.format(
        patient_first_name=first_name,
        medication=medication,
        indication=f", the one {indication}" if indication else "",
        when=when_phrase,
        take=DOSE_TAKE_NOW if due_now else DOSE_TAKE_LATER,
    )


def _remember_turn(session: SessionState, patient_id: str, role: str, text: str) -> None:
    said = (text or "").strip()
    if not said:
        return
    history = session.conversations.setdefault(patient_id, [])
    history.append({"role": role, "text": said})
    if len(history) > CONVERSATION_HISTORY_LIMIT:
        del history[: len(history) - CONVERSATION_HISTORY_LIMIT]


def _agent_turns(session: SessionState, patient_id: str) -> int:
    return sum(
        1 for turn in session.conversations.get(patient_id, [])
        if turn["role"] == "agent"
    )


CONVERSATION_ANYTHING_ELSE = "Is there anything else on your mind today, {patient_first_name}?"


def _loop_back(base_url: str, patient_id: str, session_id: str, said: str, closing: str) -> str:
    action = base_url.rstrip("/") + "/voice/checkin/respond?" + urlencode({
        "patient_id": patient_id, SESSION_QUERY_PARAM: session_id,
    })
    return (
        f'<Gather input="speech" action="{xml_escape(action)}" method="POST" '
        'speechTimeout="auto" timeout="8" language="en-US">'
        + _say(said)
        + "</Gather>"
        + _say(CONVERSATION_GOODBYE)
        + closing
    )


async def _keep_talking(
    session: SessionState, patient: dict, patient_id: str, base_url: str, lead: str = "",
    ask_model: bool = True, transcript: str = "",
) -> str:
    first_name = _first_name(patient)
    closing = _say(CHECKIN_CLOSING.format(patient_first_name=first_name)) + "<Hangup/>"

    def hang_up(text: str) -> str:
        _remember_turn(session, patient_id, "agent", text)
        return (_say(text) if text else "") + closing

    if ask_model and _wants_to_end_call(transcript):
        return hang_up(lead)

    if not ask_model:
        if not conversation.is_configured() or _agent_turns(session, patient_id) >= conversation.MAX_TURNS:
            return hang_up(lead)
        said = (lead + " " + CONVERSATION_ANYTHING_ELSE.format(patient_first_name=first_name)).strip()
        _remember_turn(session, patient_id, "agent", said)
        return _loop_back(base_url, patient_id, session.session_id, said, closing)

    if not conversation.is_configured():
        return hang_up(lead)
    if _agent_turns(session, patient_id) >= conversation.MAX_TURNS:
        return hang_up(lead)

    try:
        reply = await _offload(
            conversation.reply,
            list(session.conversations.get(patient_id, [])),
            _conversation_context(patient),
        )
    except Exception:
        reply = None

    if reply is None:
        return hang_up(lead)

    if reply["end_call"]:
        said = (lead + " " + reply["say"]).strip() if lead else reply["say"]
        _remember_turn(session, patient_id, "agent", said)
        return _say(said) + closing

    said = reply["say"]
    _remember_turn(session, patient_id, "agent", said)

    if reply["offer_booking"] and patient_id not in session.pending_bookings:
        recent = [
            turn["text"] for turn in session.conversations.get(patient_id, [])
            if turn["role"] == "patient"
        ]
        session.pending_bookings[patient_id] = {
            "specialty": "Internal Medicine",
            "tier": "moderate",
            "transcript": recent[-1] if recent else "",
            "proposed": None,
            "rejected_slots": [],
            "offer_count": 0,
        }

    return _loop_back(base_url, patient_id, session.session_id, said, closing)


def _set_call_state(session: SessionState, leg: str, **fields) -> dict:
    state = session.call_state.get(leg, {"leg": leg, "attempt": 1, "max_attempts": MAX_CALL_ATTEMPTS})
    state.update(fields)
    state["wording"] = CALL_PHASE_WORDING.get(state.get("phase"), "")
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    session.call_state[leg] = state
    return state


async def _emit_call_result(session: SessionState, leg: str, to: str, result: dict) -> None:
    event = "PHONE_CALL_DIALED" if result["ok"] else "PHONE_CALL_FAILED"
    if result["ok"]:
        current = (session.call_state.get(leg) or {}).get("phase")
        phase = CALL_PHASE_REDIALLING if current == CALL_PHASE_REDIALLING else CALL_PHASE_RINGING
        _set_call_state(session, leg, phase=phase, call_sid=result.get("call_sid"))
    else:
        _set_call_state(session, leg, phase=CALL_PHASE_ENDED, error=result.get("error"))
    await session.bus.emit(event, {
        "leg": leg,
        "to": telephony.mask_phone(to),
        "call_sid": result.get("call_sid"),
        "error": result.get("error"),
    })


@app.api_route("/voice/checkin", methods=["GET", "POST"])
async def voice_checkin(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    session: SessionState = Depends(get_session),
):
    await _verify_twilio_request(request)
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")
    await session.bus.emit("CALL_CONNECTED", {"patient_id": patient_id, "leg": "checkin"})

    first_name = _first_name(patient)
    medication = _spoken_medication(patient)
    indication = _spoken_indication(patient)
    flagged = _next_dose_is_flagged(patient)
    when_phrase, due_now = _dose_timing(patient)
    if flagged:
        await session.bus.emit("DOSE_PROMPT_WITHHELD", {
            "patient_id": patient_id, "ingredients": flagged,
        })

    action = str(request.base_url).rstrip("/") + "/voice/checkin/respond?" + urlencode({
        "patient_id": patient_id, SESSION_QUERY_PARAM: session.session_id,
    })

    opener = _checkin_opener(patient)
    session.conversations.pop(patient_id, None)
    session.pending_bookings.pop(patient_id, None)
    _remember_turn(
        session, patient_id, "agent",
        CHECKIN_GREETING.format(patient_first_name=first_name) + " " + opener,
    )

    return _twiml(
        _say(CHECKIN_GREETING.format(patient_first_name=first_name))
        + '<Pause length="1"/>'
        + f'<Gather input="speech" action="{xml_escape(action)}" method="POST" '
        'speechTimeout="auto" timeout="8" language="en-US">'
        + _say(opener)
        + "</Gather>"
        + _say(
            (CHECKIN_NO_ANSWER_FLAGGED if flagged else CHECKIN_NO_ANSWER).format(
                medication=medication,
            )
        )
        + "<Hangup/>"
    )


CRISIS_HOLD_SECONDS = 600


def _crisis_hold_tail(base_url: str, patient_id: str, session_id: str) -> str:
    params = urlencode({"patient_id": patient_id, SESSION_QUERY_PARAM: session_id})
    target = base_url.rstrip("/") + "/voice/checkin/hold?" + params
    return (
        f'<Pause length="{CRISIS_HOLD_SECONDS}"/>'
        + f"<Redirect>{xml_escape(target)}</Redirect>"
    )


def _fallback_twiml_body(transcript: str, fallback_base_url: str = "") -> str:
    if CRISIS_RULES.intersection(detect_emergency(transcript)):
        return (
            _say(CHECKIN_CRISIS_HOLD)
            + '<Pause length="10"/>'
            + _say(CHECKIN_CRISIS_HOLD)
            + _crisis_hold_tail(fallback_base_url, DEFAULT_DEMO_PATIENT_ID, "")
        )
    return _say(CHECKIN_TRIAGE_UNAVAILABLE) + "<Hangup/>"


async def _record_voice_escalation(
    session: SessionState, patient_id: str, result: dict, transcript: str = "",
) -> None:
    patient = session.patients.get(patient_id)
    record = record_escalation(
        patient_id,
        result["tier"],
        result["is_crisis"],
        datetime.now(timezone.utc),
        store=session.escalations,
    )
    if record:
        provider = escalation.assigned_provider(patient) if patient else {"name": "the on call clinician"}
        if patient:
            await _maybe_alert_provider(session, patient, record, transcript)
        await session.bus.emit("ESCALATION_FIRED", {
            "kind": record["kind"],
            "would_notify": record["would_notify"],
            "notification_delivered": record["notification_delivered"],
            "ack_window_would_expire_at": record["ack_window_would_expire_at"],
            "channel": "voice",
            "provider_name": provider["name"],
            "headline": _escalation_headline(record, provider["name"]),
        })


@app.post("/voice/checkin/respond")
async def voice_checkin_respond(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    session: SessionState = Depends(get_session),
):
    await _verify_twilio_request(request)
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")
    first_name = _first_name(patient)

    raw_body = (await request.body()).decode("utf-8")
    fields = dict(parse_qsl(raw_body))
    transcript = (fields.get("SpeechResult") or "").strip()
    if not transcript:
        silent_template = (
            CHECKIN_NO_ANSWER_FLAGGED if _next_dose_is_flagged(patient) else CHECKIN_NO_ANSWER
        )
        return _twiml(
            _say(silent_template.format(medication=_spoken_medication(patient)))
            + "<Hangup/>"
        )

    if not session.conversations.get(patient_id):
        _remember_turn(
            session, patient_id, "agent",
            CHECKIN_GREETING.format(patient_first_name=first_name)
            + " " + _checkin_opener(patient),
        )
    _remember_turn(session, patient_id, "patient", transcript)

    call_sid = (fields.get("CallSid") or "").strip()
    if call_sid:
        _remember_bounded(session.answered_calls, call_sid, ANSWERED_CALL_CAPACITY)
    _set_call_state(session, "checkin", phase=CALL_PHASE_ANSWERED, call_sid=call_sid or None)

    try:
        result = await run_triage(session, transcript, patient_id)
    except Exception:
        return _twiml(_fallback_twiml_body(transcript, str(request.base_url)))

    if not result["is_crisis"] and not result["is_emergency"]:
        noted = _record_dose_taken(session, patient_id, transcript)
        if noted:
            await session.bus.emit("DOSE_CONFIRMED", {
                "patient_id": patient_id,
                "medication_id": noted["medication_id"],
                "at": noted["timestamp"],
            })
        _record_episode(
            session, patient_id, transcript, result,
            "logged" if not noted else "dose_confirmed",
        )
        await session.bus.emit("MEMORY_WRITE", {
            "patient_id": patient_id, "tier": result["tier"],
        })

    if result["is_crisis"]:
        session.pending_bookings.pop(patient_id, None)
        try:
            await _record_voice_escalation(session, patient_id, result, transcript)
        except Exception:
            pass
        return _twiml(
            _say(result["suggested_agent_response"])
            + '<Pause length="3"/>'
            + _say(CHECKIN_CRISIS_HOLD)
            + '<Pause length="10"/>'
            + _say(CHECKIN_CRISIS_HOLD)
            + _crisis_hold_tail(str(request.base_url), patient_id, session.session_id)
        )

    if result["is_emergency"]:
        session.pending_bookings.pop(patient_id, None)
        try:
            await _record_voice_escalation(session, patient_id, result, transcript)
        except Exception:
            pass
        return _twiml(
            _say(result["suggested_agent_response"])
            + '<Pause length="1"/>'
            + _say(CHECKIN_EMERGENCY_CLOSING)
            + "<Hangup/>"
        )

    pending = session.pending_bookings.get(patient_id)

    if pending and not pending.get("proposed") and _confirms_appointment(transcript):
        proposed_call = _propose_slot(patient, pending)
        if proposed_call is None:
            session.pending_bookings.pop(patient_id, None)
            ack = BOOKING_NO_TIME_WORKS
        else:
            await session.bus.emit("BOOKING_PROPOSED", {
                "patient_id": patient_id,
                "provider_name": proposed_call["provider"]["name"],
                "time": proposed_call["slot"],
            })
            ack = _propose_message(proposed_call, pending["offer_count"] == 1)
        return _twiml(await _keep_talking(
            session, patient, patient_id, str(request.base_url), ack, ask_model=False,
        ))

    if pending and pending.get("proposed") and _confirms_appointment(transcript):
        session.pending_bookings.pop(patient_id, None)
        call = plan_clinic_call(
            pending["specialty"],
            patient["insurance_payer_id"],
            patient.get("insurance_display_name", "their insurer"),
            patient["name"],
            pending["tier"],
            pending["transcript"],
            exclude=_rejected_slot_keys(pending),
        )
        if call:
            _remember_booking(session, patient_id, {
                "provider_name": call["provider"]["name"],
                "specialty": call["provider"]["specialty"],
                "time": call["slot"],
                "disclosure": call["disclosure"],
                "simulated_front_desk": call["simulated"],
            }, pending["transcript"])
            ack = (
                f"Great, I have booked you with {call['provider']['name']} at "
                f"{followup.format_slot(call['slot'])}."
            )
        else:
            ack = (
                "I could not find an opening right now, so please call the "
                "clinic yourself."
            )
        return _twiml(await _keep_talking(
            session, patient, patient_id, str(request.base_url), ack, ask_model=False,
        ))

    if pending and pending.get("proposed") and _wants_different_time(transcript):
        _reject_proposed_slot(pending)
        proposed_call = _propose_slot(patient, pending)
        if proposed_call is None:
            session.pending_bookings.pop(patient_id, None)
            ack = BOOKING_NO_TIME_WORKS
        else:
            await session.bus.emit("BOOKING_PROPOSED", {
                "patient_id": patient_id,
                "provider_name": proposed_call["provider"]["name"],
                "time": proposed_call["slot"],
            })
            ack = _propose_message(proposed_call, False)
        return _twiml(await _keep_talking(
            session, patient, patient_id, str(request.base_url), ack, ask_model=False,
        ))

    if pending and _declines_appointment(transcript):
        session.pending_bookings.pop(patient_id, None)
        return _twiml(await _keep_talking(
            session, patient, patient_id, str(request.base_url),
            "No problem, I will not book anything.", ask_model=False,
        ))

    if pending is None and _requests_appointment(transcript):
        call = plan_clinic_call(
            "Internal Medicine",
            patient["insurance_payer_id"],
            patient.get("insurance_display_name", "their insurer"),
            patient["name"],
            result["tier"],
            transcript,
        )
        if call:
            _remember_booking(session, patient_id, {
                "provider_name": call["provider"]["name"],
                "specialty": call["provider"]["specialty"],
                "time": call["slot"],
                "disclosure": call["disclosure"],
                "simulated_front_desk": call["simulated"],
            }, transcript)
            ack = (
                f"Sure, I have booked you with {call['provider']['name']} at "
                f"{followup.format_slot(call['slot'])}."
            )
        else:
            ack = (
                "I could not find an opening right now, so please call the "
                "clinic yourself."
            )
        return _twiml(await _keep_talking(
            session, patient, patient_id, str(request.base_url), ack, ask_model=False,
        ))

    if result["tier"] in ("moderate", "severe"):
        if pending is None:
            try:
                await _record_voice_escalation(session, patient_id, result, transcript)
            except Exception:
                pass

        if _agent_turns(session, patient_id) >= conversation.MAX_TURNS:
            session.pending_bookings.pop(patient_id, None)
            _remember_turn(session, patient_id, "agent", result["suggested_agent_response"])
            return _twiml(
                _say(result["suggested_agent_response"])
                + _say(CHECKIN_CLOSING.format(patient_first_name=first_name))
                + "<Hangup/>"
            )

        session.pending_bookings[patient_id] = {
            "specialty": "Internal Medicine",
            "tier": result["tier"],
            "transcript": transcript,
            "proposed": None,
            "rejected_slots": [],
            "offer_count": 0,
        }
        action = str(request.base_url).rstrip("/") + "/voice/checkin/respond?" + urlencode({
            "patient_id": patient_id, SESSION_QUERY_PARAM: session.session_id,
        })
        _remember_turn(session, patient_id, "agent", result["suggested_agent_response"])
        return _twiml(
            f'<Gather input="speech" action="{xml_escape(action)}" method="POST" '
            'speechTimeout="auto" timeout="8" language="en-US">'
            + _say(result["suggested_agent_response"])
            + "</Gather>"
            + _say(
                "I did not hear an answer, so I will not book anything right now."
            )
            + _say(CHECKIN_CLOSING.format(patient_first_name=first_name))
            + "<Hangup/>"
        )

    return _twiml(await _keep_talking(
        session, patient, patient_id, str(request.base_url), result["suggested_agent_response"],
        transcript=transcript,
    ))


@app.api_route("/voice/checkin/hold", methods=["GET", "POST"])
async def voice_checkin_hold(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    session: SessionState = Depends(get_session),
):
    await _verify_twilio_request(request)
    await session.bus.emit("CRISIS_LINE_HELD", {"patient_id": patient_id})
    return _twiml(
        _say(CHECKIN_CRISIS_HOLD)
        + _crisis_hold_tail(str(request.base_url), patient_id, session.session_id)
    )


@app.post("/voice/checkin/status")
async def voice_checkin_status(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    attempt: int = 1,
    sig: str = "",
    nonce: str = "",
    session: SessionState = Depends(get_session),
):
    if not _callback_signature_valid(patient_id, session.session_id, attempt, nonce, sig):
        raise HTTPException(403, "bad_callback_signature")

    attempt = max(1, min(int(attempt), MAX_CALL_ATTEMPTS))

    fields = dict(parse_qsl((await request.body()).decode("utf-8")))
    status = (fields.get("CallStatus") or "").strip().lower()
    answered_by = (fields.get("AnsweredBy") or "").strip().lower()
    call_sid = (fields.get("CallSid") or "").strip()
    try:
        duration = int(fields.get("CallDuration") or 0)
    except ValueError:
        duration = 0

    if not _consume_callback(session, nonce, call_sid, attempt):
        return Response(status_code=204)

    engaged = bool(call_sid) and call_sid in session.answered_calls
    long_enough = status == "completed" and duration >= ANSWERED_CALL_SECONDS
    picked_up = (engaged or long_enough) and not answered_by.startswith("machine")

    if picked_up:
        _set_call_state(
            session, "checkin", phase=CALL_PHASE_ENDED,
            attempt=attempt, last_status=status,
        )
        await session.bus.emit("PHONE_CALL_ENDED", {
            "leg": "checkin", "status": status, "duration": duration,
            "attempt": attempt, "engaged": engaged,
        })
        return Response(status_code=204)

    patient = session.patients.get(patient_id)
    first_name = _first_name(patient)
    medication = _spoken_medication(patient)
    flagged = _next_dose_is_flagged(patient)
    body = _sms_body(
        CHECKIN_SMS_FLAGGED if flagged else CHECKIN_SMS, first_name, medication,
    )

    to = telephony.demo_phone_number()
    if not session.call_limiter.allow():
        sent = {"ok": False, "sid": None, "error": "text_rate_limited"}
    else:
        sent = await _offload(telephony.send_sms, to, body)
        session.call_limiter.record()

    _set_call_state(
        session, "checkin",
        phase=CALL_PHASE_TEXTED if sent["ok"] else CALL_PHASE_GAVE_UP,
        attempt=attempt, last_status=status, message_sid=sent.get("sid"),
        error=sent.get("error"),
    )
    await session.bus.emit(
        "TEXT_MESSAGE_SENT" if sent["ok"] else "TEXT_MESSAGE_FAILED",
        {
            "leg": "checkin", "to": telephony.mask_phone(to),
            "reason": status, "flagged": bool(flagged), "error": sent.get("error"),
        },
    )
    return Response(status_code=204)


@app.api_route("/voice/clinic", methods=["GET", "POST"])
async def voice_clinic(
    request: Request,
    specialty: str = "Internal Medicine",
    payer_id: str = "",
    payer_display: str = "their insurer",
    patient_name: str = "the patient",
    tier: str = "moderate",
    transcript: str = "Routine follow-up requested from the CareLoop demo.",
    session: SessionState = Depends(get_session),
):
    await _verify_twilio_request(request)
    await session.bus.emit("CALL_CONNECTED", {"leg": "clinic"})

    call = plan_clinic_call(specialty, payer_id or None, payer_display, patient_name, tier, transcript)
    lines = [_say(CLINIC_CALL_SELF_IDENTIFICATION), _say(FRONT_DESK_DISCLOSURE)]
    if call is None:
        lines.append(_say("No appointment slot is currently available for this specialty."))
    else:
        for turn in call["turns"]:
            voice = CARELOOP_VOICE if turn["speaker"] == "careloop" else CLINIC_VOICE
            lines.append(_say(turn["text"], voice=voice))
            event = "CLINIC_AGENT_SPEECH" if turn["speaker"] == "careloop" else "CLINIC_DESK_SPEECH"
            await session.bus.emit(event, {"text": turn["text"]})
    lines.append("<Hangup/>")
    return _twiml("".join(lines))


CALL_TOKEN = os.environ.get("CARELOOP_CALL_TOKEN", "")


def _authorize_call(supplied: Optional[str]) -> None:
    expected = CALL_TOKEN or WEBHOOK_SECRET
    if expected and supplied != expected:
        raise HTTPException(401, "unauthorized")


EPHEMERAL_CALLBACK_SECRET = secrets.token_hex(32)


def _callback_secret() -> bytes:
    return (CALL_TOKEN or WEBHOOK_SECRET or EPHEMERAL_CALLBACK_SECRET).encode("utf-8")


def callback_signing_mode() -> str:
    return "configured" if (CALL_TOKEN or WEBHOOK_SECRET) else "ephemeral"


def _callback_signature(patient_id: str, session_id: str, attempt: int, nonce: str) -> str:
    import hashlib
    import hmac

    basis = f"{patient_id}|{session_id}|{attempt}|{nonce}".encode("utf-8")
    return hmac.new(_callback_secret(), basis, hashlib.sha256).hexdigest()[:32]


def _callback_signature_valid(
    patient_id: str, session_id: str, attempt: int, nonce: str, sig: str,
) -> bool:
    import hmac

    expected = _callback_signature(patient_id, session_id, attempt, nonce)
    return hmac.compare_digest(expected, sig or "")


def _issue_callback_nonce(session: SessionState, attempt: int) -> str:
    nonce = secrets.token_urlsafe(12)
    _remember_bounded(session.callback_nonces, nonce, CALLBACK_NONCE_CAPACITY)
    return nonce


def _consume_callback(session: SessionState, nonce: str, call_sid: str, attempt: int) -> bool:
    key = f"{call_sid}|{attempt}"
    if key in session.consumed_callbacks:
        return False
    if not nonce or nonce not in session.callback_nonces:
        return False
    session.callback_nonces.pop(nonce, None)
    _remember_bounded(session.consumed_callbacks, key, CONSUMED_CALLBACK_CAPACITY)
    return True


def _one_line(text: str) -> str:
    return " ".join((text or "").split())


def _sms_body(template: str, first_name: str, medication: str) -> str:
    skeleton = len(template.format(patient_first_name="", medication=""))
    room = max(0, SMS_MAX_CHARS - skeleton)
    name = _one_line(first_name)[: min(SMS_MAX_NAME_CHARS, room)]
    medication = _one_line(medication)[: max(0, room - len(name))]
    return template.format(patient_first_name=name, medication=medication)


async def _offload(fn, *args, **kwargs):
    return await asyncio.to_thread(fn, *args, **kwargs)


async def _dial_checkin(
    base_url: str, session: SessionState, patient_id: str, to: str, attempt: int,
) -> dict:
    twiml_url = base_url + "/voice/checkin?" + urlencode({
        "patient_id": patient_id, SESSION_QUERY_PARAM: session.session_id,
    })
    nonce = _issue_callback_nonce(session, attempt)
    status_url = base_url + "/voice/checkin/status?" + urlencode({
        "patient_id": patient_id,
        "attempt": attempt,
        "nonce": nonce,
        "sig": _callback_signature(patient_id, session.session_id, attempt, nonce),
        SESSION_QUERY_PARAM: session.session_id,
    })
    return await _offload(
        telephony.place_call, to, twiml_url=twiml_url, status_callback=status_url
    )


class CallStartRequest(BaseModel):
    secret: Optional[str] = None
    patient_id: Optional[str] = None


@app.post("/call/start")
async def call_start(
    body: CallStartRequest, request: Request, session: SessionState = Depends(get_session),
):
    _authorize_call(body.secret)

    missing = telephony.missing_env_vars()
    if missing:
        return _telephony_not_configured(missing)

    if not session.call_limiter.allow():
        raise HTTPException(429, "call_rate_limited")

    patient_id = body.patient_id or DEFAULT_DEMO_PATIENT_ID
    if patient_id not in session.patients:
        raise HTTPException(404, "unknown_patient")

    to = telephony.demo_phone_number()
    result = await _dial_checkin(
        str(request.base_url).rstrip("/"), session, patient_id, to, attempt=1,
    )
    session.call_limiter.record()
    await _emit_call_result(session, "checkin", to, result)

    return {"configured": True, **result}


TOOK_IT = re.compile(
    r"\b(took|taken|swallowed)\b|\byes\b|\bdone\b|\ball good\b",
    re.IGNORECASE,
)
DID_NOT_TAKE = re.compile(
    r"\b(haven'?t|have not|didn'?t|did not|hadn'?t|had not)\b"
    r"[^.!?]{0,15}\b(took|taken|take|it|dose|pill|medicine|medication)\b"
    r"|\b(skipped|missed|forgot)\b[^.!?]{0,15}\b(it|dose|pill|medicine|medication)\b"
    r"|\bnot\s+(yet|today|this morning|this evening)\b"
    r"|^\s*no\b[\s,.!]*$",
    re.IGNORECASE,
)


def _said_they_took_it(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text or DID_NOT_TAKE.search(text):
        return False
    return bool(TOOK_IT.search(text))


def _record_episode(
    session: SessionState, patient_id: str, transcript: str, result: dict,
    action_taken: str,
) -> dict:
    episode = {
        "call_id": uuid.uuid4().hex,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "transcript": transcript,
        "tier": result["tier"],
        "action_taken": action_taken,
        "summary": summarize_episode(transcript, result["tier"], action_taken),
        "is_crisis": result["is_crisis"],
    }
    session.memory.append_episode(patient_id, episode)
    return episode


def _record_dose_taken(session: SessionState, patient_id: str, transcript: str) -> Optional[dict]:
    if not _said_they_took_it(transcript):
        return None
    patient = session.patients.get(patient_id)
    if patient is None:
        return None
    dose = build_day_plan(patient)["next_dose"]
    if not dose or dose["status"] not in ("due_now", "due_soon", "missed"):
        return None
    entry = {
        "call_id": "call-" + uuid.uuid4().hex[:8],
        "timestamp": clinic_now().isoformat(),
        "outcome": "answered",
        "taken": True,
        "medication_id": dose["medication_id"],
        "dose_hour": int(dose["time"].split(":")[0]),
        "symptom_reported": None,
        "tier": "mild",
        "action_taken": "dose_confirmed",
    }
    patient.setdefault("history", []).append(entry)
    return entry


BOOKING_YES_STRONG = re.compile(
    r"\b(yes|yeah|yep|yup|book it|let'?s do it)\b",
    re.IGNORECASE,
)
BOOKING_YES_WEAK = re.compile(
    r"\b(sure|okay|ok|please|that works|sounds good|"
    r"go ahead|works for me|absolutely|definitely|mhm|mm-?hmm|uh[- ]?huh)\b",
    re.IGNORECASE,
)
BOOKING_YES_SHORT_ANSWER_WORDS = 3

BOOKING_NO = re.compile(
    r"\b(nope|nah|not now|not today|not necessary|not needed|"
    r"i'?ll pass|rather not|don'?t book|do not book|no thanks|"
    r"don'?t want|do not want|not interested)\b|"
    r"\bno\b(?!\s*[a-zA-Z])",
    re.IGNORECASE,
)


NEGATED_YES = re.compile(
    r"\b(not|isn'?t|aren'?t|won'?t|can'?t|never|no)\s+\w{0,6}\s?"
    r"(yes|sure|okay|ok|good|fine|absolutely|definitely)\b|"
    r"\b(absolutely|definitely|sure|okay|ok)\s+(not|never)\b",
    re.IGNORECASE,
)

FILLER_NO = re.compile(
    r"\b(yeah|yep|yup|sure|totally),?\s+no\b|"
    r"\bno\s+problem\b|\bno\s+worries\b|"
    r"\bno,?\s+(that'?d|that\s+would|that'?s|that\s+is)\b",
    re.IGNORECASE,
)


def _strip_filler_no(text: str) -> str:
    return FILLER_NO.sub(" ", text)


def _confirms_appointment(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text:
        return False
    scrubbed = _strip_filler_no(text)
    if BOOKING_NO.search(scrubbed) or NEGATED_YES.search(scrubbed):
        return False
    if BOOKING_YES_STRONG.search(text):
        return True
    is_short_answer = len(text.split()) <= BOOKING_YES_SHORT_ANSWER_WORDS
    return is_short_answer and bool(BOOKING_YES_WEAK.search(text))


def _declines_appointment(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text:
        return False
    return bool(BOOKING_NO.search(_strip_filler_no(text)))


BOOKING_REQUEST = re.compile(
    r"\b(book|schedule|set up|line up|get|make) (me |us )?(an?|the) "
    r"(appointment|follow[- ]?up|visit)\b|"
    r"\b(i want|i need|i'?d like|i would like) (an?|the) "
    r"(appointment|follow[- ]?up|visit)\b|"
    r"\b(i'?d like to|i would like to|i want to|i need to) (go )?see "
    r"(a |the |my )?(doctor|physician|provider|someone)\b",
    re.IGNORECASE,
)


def _requests_appointment(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text:
        return False
    scrubbed = _strip_filler_no(text)
    if BOOKING_NO.search(scrubbed) or NEGATED_YES.search(scrubbed):
        return False
    return bool(BOOKING_REQUEST.search(text))


BOOKING_WANTS_DIFFERENT_TIME = re.compile(
    r"\b(i'?m|i am) busy\b|"
    r"\b(i )?(can'?t|cannot) make it\b|"
    r"\b(that|it) (doesn'?t|does not|won'?t|will not) work\b|"
    r"\b(do you have|is there) (an?other|a different) time\b|"
    r"\bsomething else that day\b|"
    r"\bi have a conflict\b|"
    r"\b(can|could) we (do|find|pick|get) (an?other|a different) (time|day)\b",
    re.IGNORECASE,
)


def _wants_different_time(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text:
        return False
    scrubbed = _strip_filler_no(text)
    if BOOKING_NO.search(scrubbed) or NEGATED_YES.search(scrubbed):
        return False
    return bool(BOOKING_WANTS_DIFFERENT_TIME.search(text))


END_CALL_REQUEST = re.compile(
    r"\b(bye|goodbye|good bye|talk to you later|gotta go|got to go)\b\W*$|"
    r"\b(that'?s|that is) (all|it)\b[\s,]*(thanks?|thank you)?\W*$|"
    r"\bnothing else\b[\s,]*(thanks?|thank you)?\W*$|"
    r"\bi'?m (good|done)\b[\s,]*(thanks?|thank you)?\W*$|"
    r"\bi am (good|done)\b[\s,]*(thanks?|thank you)?\W*$",
    re.IGNORECASE,
)


def _wants_to_end_call(transcript: str) -> bool:
    text = (transcript or "").strip()
    if not text:
        return False
    return bool(END_CALL_REQUEST.search(text))


def _remember_booking(
    session: SessionState, patient_id: str, booking: dict, transcript: str,
) -> None:
    held = session.bookings.setdefault(patient_id, [])
    if any(b["slot"] == booking["time"] and b["provider_name"] == booking["provider_name"]
           for b in held):
        return
    held.append({
        "provider_name": booking["provider_name"],
        "specialty": booking["specialty"],
        "slot": booking["time"],
        "disclosure": booking["disclosure"],
        "simulated_front_desk": booking.get("simulated_front_desk", True),
        "booked_at": datetime.now(timezone.utc).isoformat(),
        "reason_transcript": (transcript or "").strip()[:160],
    })
    del held[:-10]


BOOKING_OFFER_CAP = 3
BOOKING_NO_TIME_WORKS = (
    "I'm not able to find a time that works right now, so please call the "
    "clinic yourself to schedule."
)


def _rejected_slot_keys(pending: dict):
    return {
        (rejected["provider_id"], rejected["slot"])
        for rejected in pending.get("rejected_slots", [])
    }


def _propose_slot(patient: dict, pending: dict) -> Optional[dict]:
    if pending.get("offer_count", 0) >= BOOKING_OFFER_CAP:
        return None
    call = plan_clinic_call(
        pending["specialty"],
        patient["insurance_payer_id"],
        patient.get("insurance_display_name", "their insurer"),
        patient["name"],
        pending["tier"],
        pending["transcript"],
        exclude=_rejected_slot_keys(pending),
    )
    if call is None:
        return None
    pending["proposed"] = {
        "provider_id": call["provider"]["provider_id"],
        "provider_name": call["provider"]["name"],
        "specialty": call["provider"]["specialty"],
        "slot": call["slot"],
    }
    pending["offer_count"] = pending.get("offer_count", 0) + 1
    return call


def _reject_proposed_slot(pending: dict) -> None:
    proposed = pending.get("proposed")
    if proposed:
        pending.setdefault("rejected_slots", []).append(
            {"provider_id": proposed["provider_id"], "slot": proposed["slot"]}
        )
    pending["proposed"] = None


def _propose_message(call: dict, is_first_offer: bool) -> str:
    when = followup.format_slot(call["slot"])
    if is_first_offer:
        return (
            f"I can get you in with {call['provider']['name']} on {when}. "
            "Does that work for you?"
        )
    return f"How about {call['provider']['name']} on {when}? Does that work?"


def _booking_as_visit(patient: dict, booking: dict) -> dict:
    said = booking.get("reason_transcript") or ""
    reason = (
        f"You said: {said}" if said
        else "Booked during a check-in."
    )
    return {
        "note_id": "checkin-" + booking["slot"],
        "status": followup.STATUS_BOOKED,
        "source": "check_in",
        "specialty": booking["specialty"],
        "provider_name": booking["provider_name"],
        "provider": None,
        "slot": booking["slot"],
        "slot_local": followup.format_slot(booking["slot"]),
        "starts_at": booking["slot"],
        "due_date": None,
        "in_network": True,
        "prescriber": None,
        "reason": reason,
        "note_text": None,
        "issue": None,
        "issue_detail": None,
        "simulated": booking.get("simulated_front_desk", True),
        "disclosure": booking.get("disclosure"),
        "payer_display": patient.get("insurance_display_name"),
        "payer_id": patient.get("insurance_payer_id"),
        "patient_id": patient.get("patient_id"),
        "patient_name": patient.get("name"),
        "patient_first_name": _first_name(patient),
        "reminders": [],
    }


@app.get("/followups/{patient_id}")
def followups(patient_id: str, session: SessionState = Depends(get_session)):
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    now = datetime.now(timezone.utc)
    visits = followup.plan_with_reminders(patient, today=now.date(), now=now)
    for held in session.bookings.get(patient_id, []):
        visits.append(_booking_as_visit(patient, held))
    visits.sort(key=lambda v: v.get("slot") or "9999")
    booked = [v for v in visits if v["status"] == followup.STATUS_BOOKED]
    return {
        "patient_id": patient_id,
        "as_of": now.isoformat(),
        "payer_display": patient.get("insurance_display_name"),
        "payer_id": patient.get("insurance_payer_id"),
        "preferred_contact_window": patient.get("preferred_contact_window"),
        "visits": visits,
        "booked_count": len(booked),
        "reminders": [r for v in booked for r in v["reminders"]],
        "disclosure": FRONT_DESK_DISCLOSURE,
    }


def _find_reminder(patient: dict, note_id: str, kind: str) -> Optional[dict]:
    now = datetime.now(timezone.utc)
    for visit in followup.plan_with_reminders(patient, today=now.date(), now=now):
        if visit["note_id"] != note_id:
            continue
        for reminder in visit["reminders"]:
            if reminder["kind"] == kind:
                return reminder
        if not visit.get("starts_at"):
            continue
        for reminder in followup.reminder_plan(visit, now=None):
            if reminder["kind"] == kind:
                return reminder
    return None


@app.api_route("/voice/reminder", methods=["GET", "POST"])
async def voice_reminder(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    note_id: str = "",
    kind: str = followup.KIND_DAY_BEFORE,
    session: SessionState = Depends(get_session),
):
    await _verify_twilio_request(request)
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    await session.bus.emit("CALL_CONNECTED", {"patient_id": patient_id, "leg": "reminder"})

    reminder = _find_reminder(patient, note_id, kind)
    if reminder is None:
        return _twiml(
            _say("CareLoop has no appointment reminder for you right now. Goodbye.")
            + "<Hangup/>"
        )

    await session.bus.emit("APPOINTMENT_REMINDER_SPOKEN", {
        "patient_id": patient_id,
        "note_id": note_id,
        "kind": kind,
        "visit_at": reminder["visit_at"],
    })
    return _twiml(_say(reminder["script"]) + "<Hangup/>")


class ReminderCallRequest(BaseModel):
    secret: Optional[str] = None
    patient_id: Optional[str] = None
    note_id: Optional[str] = None
    kind: str = followup.KIND_DAY_BEFORE


@app.post("/call/reminder")
async def call_reminder(
    body: ReminderCallRequest, request: Request, session: SessionState = Depends(get_session),
):
    _authorize_call(body.secret)

    missing = telephony.missing_env_vars()
    if missing:
        return _telephony_not_configured(missing)

    if not session.call_limiter.allow():
        raise HTTPException(429, "call_rate_limited")

    patient_id = body.patient_id or DEFAULT_DEMO_PATIENT_ID
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    note_id = body.note_id
    if not note_id:
        now = datetime.now(timezone.utc)
        booked = [
            v for v in followup.plan_with_reminders(patient, today=now.date(), now=now)
            if v["status"] == followup.STATUS_BOOKED
        ]
        if not booked:
            raise HTTPException(409, "no_booked_followup")
        note_id = booked[0]["note_id"]

    if _find_reminder(patient, note_id, body.kind) is None:
        raise HTTPException(409, "no_reminder_for_that_visit")

    params = {
        "patient_id": patient_id,
        "note_id": note_id,
        "kind": body.kind,
        SESSION_QUERY_PARAM: session.session_id,
    }
    twiml_url = str(request.base_url).rstrip("/") + "/voice/reminder?" + urlencode(params)

    to = telephony.demo_phone_number()
    result = await _offload(telephony.place_call, to, twiml_url=twiml_url)
    session.call_limiter.record()
    await _emit_call_result(session, "reminder", to, result)

    return {"configured": True, "note_id": note_id, "kind": body.kind, **result}


@app.get("/call/state")
def call_state(leg: str = "checkin", session: SessionState = Depends(get_session)):
    state = session.call_state.get(leg)
    if state is None:
        return {
            "leg": leg, "phase": "idle", "wording": "", "attempt": 0,
            "max_attempts": MAX_CALL_ATTEMPTS, "retrying": False,
        }
    return {
        **state,
        "retrying": state.get("phase") in {CALL_PHASE_DISCONNECTED, CALL_PHASE_REDIALLING},
    }


class ClinicCallStartRequest(BaseModel):
    secret: Optional[str] = None
    patient_id: Optional[str] = None
    specialty: Optional[str] = None


@app.post("/call/clinic")
async def call_clinic(
    body: ClinicCallStartRequest, request: Request, session: SessionState = Depends(get_session),
):
    _authorize_call(body.secret)

    missing = telephony.missing_env_vars()
    if missing:
        return _telephony_not_configured(missing)

    if not session.call_limiter.allow():
        raise HTTPException(429, "call_rate_limited")

    patient_id = body.patient_id or DEFAULT_DEMO_PATIENT_ID
    patient = session.patients.get(patient_id)
    if patient is None:
        raise HTTPException(404, "unknown_patient")

    params = {
        "specialty": body.specialty or "Internal Medicine",
        "payer_id": patient.get("insurance_payer_id") or "",
        "payer_display": patient.get("insurance_display_name", "their insurer"),
        "patient_name": patient["name"],
        "tier": "moderate",
        "transcript": "Routine follow-up requested from the CareLoop demo.",
        SESSION_QUERY_PARAM: session.session_id,
    }
    base_url = str(request.base_url).rstrip("/")
    twiml_url = base_url + "/voice/clinic?" + urlencode(params)

    to = telephony.demo_phone_number()
    result = await _offload(telephony.place_call, to, twiml_url=twiml_url)
    session.call_limiter.record()
    await _emit_call_result(session, "clinic", to, result)

    return {"configured": True, **result}


def describe_env(name: str) -> str:
    if name not in os.environ:
        return "absent"
    value = os.environ[name].strip()
    if not value:
        return "present but empty"
    return "set"


@app.get("/health")
def health():
    from triage_engine import DEFAULT_MODEL

    key = os.environ.get("GEMINI_API_KEY") or ""
    return {
        "status": "ok",
        "patients_loaded": len(BASELINE_PATIENTS),
        "gemini_configured": bool(key),
        "model": os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL,
        "env": {name: describe_env(name) for name in EXPECTED_ENV_KEYS},
        "callback_signing": callback_signing_mode(),
        "telephony_configured": telephony.is_configured(),
        "telephony_missing": telephony.missing_env_vars(),
        "runtime": os.environ.get("VERCEL_ENV", "local"),
    }


app = ProxyHeadersMiddleware(app, trusted_hosts="*")
