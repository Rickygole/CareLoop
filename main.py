import asyncio
import json
import os
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


load_dotenv()

import telephony
from clinic import FRONT_DESK_DISCLOSURE, plan_clinic_call
from contradiction import LIMITATIONS, check_cross_call, check_regimen, patient_message
from escalation import (
    ESCALATION_IS_A_RECORD_ONLY,
    NEVER_CONTACTS_EMERGENCY_SERVICES,
    get_escalations,
    record_escalation,
    reset_escalations,
    unacknowledged_for_patient,
)
from memory import InMemoryBackend, summarize_episode
from providers import find_provider, specialties
from scheduler import build_day_plan
from responses import suggested_response
from triage_engine import Severity, triage

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

SESSION_HEADER = "X-CareLoop-Session"
SESSION_QUERY_PARAM = "session_id"
SESSION_CAPACITY = 200
SESSION_IDLE_SECONDS = 1800


def load_patients() -> Dict[str, dict]:
    with open(DATA_DIR / "patients.json") as f:
        return {p["patient_id"]: p for p in json.load(f)["patients"]}


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
    "BACKBOARD_WRITE",
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
        self.memory = InMemoryBackend()
        self.escalations: Dict[str, List[dict]] = {}
        self.bus = TraceBus()
        self.call_limiter = telephony.CallLimiter()
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
    if WEBHOOK_SECRET and token != WEBHOOK_SECRET:
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
def trace_events(since: int = 0, session: SessionState = Depends(get_session)):
    return {"events": session.bus.since(since), "boot_id": session.bus.boot_id}


class ResetRequest(BaseModel):
    secret: Optional[str] = None


@app.post("/admin/reset")
async def admin_reset(body: ResetRequest, session: SessionState = Depends(get_session)):
    if WEBHOOK_SECRET and body.secret != WEBHOOK_SECRET:
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

    result = triage(transcript)

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
    if WEBHOOK_SECRET and body.secret != WEBHOOK_SECRET:
        raise HTTPException(401, "unauthorized")

    if body.patient_id and body.patient_id not in session.patients:
        raise HTTPException(404, "unknown_patient")

    await session.bus.emit("TOOL_CALL", {"tool": body.tool_name, "patient_id": body.patient_id})

    if body.tool_name == "report_symptom":
        return await run_triage(session, body.transcript or "", body.patient_id)

    if body.tool_name == "book_appointment":
        return await book_appointment(
            BookRequest(
                specialty=body.specialty or "Internal Medicine",
                urgency=body.urgency or "routine",
                patient_id=body.patient_id,
            ),
            session=session,
        )

    raise HTTPException(400, f"unknown tool {body.tool_name!r}")


class RunLoopRequest(BaseModel):
    patient_id: str
    transcript: str
    auto_book: bool = True


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
    if body.auto_book and result["tier"] in ("moderate", "severe") and not result["is_emergency"]:
        specialty = patient["medication_requests"][0]["prescriber"]
        specialty = "Internal Medicine"
        call = plan_clinic_call(
            specialty,
            patient["insurance_payer_id"],
            patient.get("insurance_display_name", "their insurer"),
            patient["name"],
            result["tier"],
            body.transcript,
        )
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
            await session.bus.emit("PATIENT_CONFIRMED", {
                "text": (
                    "This is a simulated booking. In a real deployment you would "
                    f"now be booked with {call['provider']['name']} at "
                    f"{call['slot']}. No real clinic was contacted and no "
                    "appointment exists."
                ),
            })

            missing = telephony.missing_env_vars()
            if missing:
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
                dial_result = telephony.place_call(to, twiml_url=twiml_url)
                session.call_limiter.record()
                await _emit_call_result(session, "clinic", to, dial_result)

    now = datetime.now(timezone.utc)
    escalation_record = record_escalation(
        body.patient_id, result["tier"], result["is_crisis"], now, store=session.escalations,
    )
    if escalation_record:
        await session.bus.emit("ESCALATION_FIRED", {
            "kind": escalation_record["kind"],
            "would_notify": escalation_record["would_notify"],
            "notification_delivered": escalation_record["notification_delivered"],
            "ack_window_would_expire_at": escalation_record["ack_window_would_expire_at"],
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

    await session.bus.emit("BACKBOARD_WRITE", {
        "patient_id": body.patient_id, "tier": result["tier"],
    })
    await session.bus.emit("CALL_ENDED", {"patient_id": body.patient_id})

    return {
        "triage": result,
        "plan": plan,
        "booking": booking,
        "prior_episode": prior_episode,
        "cross_call_findings": cross_call_findings,
        "escalation": escalation_record,
        "unacknowledged_escalations": unacknowledged_for_patient(
            body.patient_id, now, store=session.escalations,
        ),
        "escalation_is_a_record_only": ESCALATION_IS_A_RECORD_ONLY,
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
        "safety_statement": NEVER_CONTACTS_EMERGENCY_SERVICES,
    }


EXPECTED_ENV_KEYS = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "ELEVENLABS_API_KEY",
    "BACKBOARD_API_KEY",
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

    before_hash = regimen_hash(patient["medication_requests"])
    new_id = f"med-{len(patient['medication_requests']) + 1}-{body.patient_id}"
    patient["medication_requests"] = patient["medication_requests"] + [{
        "medication_id": new_id,
        "medication": body.medication,
        "dosage_text": body.dosage_text,
        "frequency": body.frequency,
        "timing": {"times_per_day": len(body.preferred_hours),
                   "preferred_hours": body.preferred_hours},
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
    "{patient_first_name}, it is time for your {medication}{indication}. "
    "Please take it now if you have not already. When you have, tell me you "
    "took it, and tell me how you have been feeling since."
)

CHECKIN_NO_ANSWER = (
    "I did not hear anything, so I will try you again shortly. Please "
    "remember to take your {medication}. Goodbye for now."
)

CHECKIN_CLOSING = (
    "Thank you, {patient_first_name}. I have made a note of that on your "
    "record. Please keep taking your medication as your prescriber directed. "
    "I will check in with you again. Take care."
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


def _spoken_medication(patient: Optional[dict]) -> str:
    if not patient:
        return "your medication"
    plan = build_day_plan(patient)
    dose = plan["next_dose"]
    if dose:
        dosage = _spell_dosage(dose.get("dosage"))
        return f"{dose['medication']}, {dosage}" if dosage else dose["medication"]
    return _demo_medication_name(patient)


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
        return (request.get("indication") or "").strip()
    return ""


def _telephony_not_configured(missing: List[str]) -> dict:
    return {
        "configured": False,
        "call_sid": None,
        "missing_env": missing,
        "detail": "Telephony is not configured. Set " + ", ".join(missing) + " to enable outbound calls.",
    }


async def _emit_call_result(session: SessionState, leg: str, to: str, result: dict) -> None:
    event = "PHONE_CALL_DIALED" if result["ok"] else "PHONE_CALL_FAILED"
    await session.bus.emit(event, {
        "leg": leg,
        "to": telephony.mask_phone(to),
        "call_sid": result.get("call_sid"),
        "error": result.get("error"),
    })


@app.api_route("/voice/checkin", methods=["GET", "POST"])
async def voice_checkin(
    patient_id: str = DEFAULT_DEMO_PATIENT_ID, session: SessionState = Depends(get_session),
):
    patient = session.patients.get(patient_id) or session.patients.get(DEFAULT_DEMO_PATIENT_ID)
    await session.bus.emit("CALL_CONNECTED", {"patient_id": patient_id, "leg": "checkin"})

    first_name = _first_name(patient)
    medication = _spoken_medication(patient)
    indication = _spoken_indication(patient)

    action = "/voice/checkin/respond?" + urlencode({
        "patient_id": patient_id, SESSION_QUERY_PARAM: session.session_id,
    })
    return _twiml(
        _say(CHECKIN_GREETING.format(patient_first_name=first_name))
        + '<Pause length="1"/>'
        + f'<Gather input="speech" action="{xml_escape(action)}" method="POST" '
        'speechTimeout="auto" timeout="8" language="en-US">'
        + _say(CHECKIN_DOSE_PROMPT.format(
            patient_first_name=first_name,
            medication=medication,
            indication=f", the one {indication}" if indication else "",
        ))
        + "</Gather>"
        + _say(CHECKIN_NO_ANSWER.format(medication=medication))
        + "<Hangup/>"
    )


@app.post("/voice/checkin/respond")
async def voice_checkin_respond(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    session: SessionState = Depends(get_session),
):
    patient = session.patients.get(patient_id) or session.patients.get(DEFAULT_DEMO_PATIENT_ID)
    first_name = _first_name(patient)

    raw_body = (await request.body()).decode("utf-8")
    fields = dict(parse_qsl(raw_body))
    transcript = (fields.get("SpeechResult") or "").strip()
    if not transcript:
        return _twiml(
            _say(CHECKIN_NO_ANSWER.format(medication=_spoken_medication(patient)))
            + "<Hangup/>"
        )

    result = await run_triage(session, transcript, patient_id)
    return _twiml(
        _say(result["suggested_agent_response"])
        + '<Pause length="1"/>'
        + _say(CHECKIN_CLOSING.format(patient_first_name=first_name))
        + "<Hangup/>"
    )


@app.post("/voice/checkin/status")
async def voice_checkin_status(
    request: Request,
    patient_id: str = DEFAULT_DEMO_PATIENT_ID,
    attempt: int = 1,
    session: SessionState = Depends(get_session),
):
    fields = dict(parse_qsl((await request.body()).decode("utf-8")))
    status = (fields.get("CallStatus") or "").strip().lower()
    answered_by = (fields.get("AnsweredBy") or "").strip().lower()
    try:
        duration = int(fields.get("CallDuration") or 0)
    except ValueError:
        duration = 0

    picked_up = (
        status == "completed"
        and duration >= ANSWERED_CALL_SECONDS
        and not answered_by.startswith("machine")
    )
    if picked_up or attempt >= MAX_CALL_ATTEMPTS:
        await session.bus.emit("PHONE_CALL_ENDED", {
            "leg": "checkin", "status": status, "duration": duration, "attempt": attempt,
        })
        return Response(status_code=204)

    await session.bus.emit("PHONE_CALL_RETRY", {
        "leg": "checkin", "status": status, "duration": duration, "attempt": attempt + 1,
    })
    to = telephony.demo_phone_number()
    result = _dial_checkin(
        str(request.base_url).rstrip("/"), session, patient_id, to, attempt + 1,
    )
    await _emit_call_result(session, "checkin", to, result)
    return Response(status_code=204)


@app.api_route("/voice/clinic", methods=["GET", "POST"])
async def voice_clinic(
    specialty: str = "Internal Medicine",
    payer_id: str = "",
    payer_display: str = "their insurer",
    patient_name: str = "the patient",
    tier: str = "moderate",
    transcript: str = "Routine follow-up requested from the CareLoop demo.",
    session: SessionState = Depends(get_session),
):
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


def _dial_checkin(
    base_url: str, session: SessionState, patient_id: str, to: str, attempt: int,
) -> dict:
    twiml_url = base_url + "/voice/checkin?" + urlencode({
        "patient_id": patient_id, SESSION_QUERY_PARAM: session.session_id,
    })
    status_url = base_url + "/voice/checkin/status?" + urlencode({
        "patient_id": patient_id,
        "attempt": attempt,
        SESSION_QUERY_PARAM: session.session_id,
    })
    return telephony.place_call(to, twiml_url=twiml_url, status_callback=status_url)


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
    result = _dial_checkin(
        str(request.base_url).rstrip("/"), session, patient_id, to, attempt=1,
    )
    session.call_limiter.record()
    await _emit_call_result(session, "checkin", to, result)

    return {"configured": True, **result}


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
    result = telephony.place_call(to, twiml_url=twiml_url)
    session.call_limiter.record()
    await _emit_call_result(session, "clinic", to, result)

    return {"configured": True, **result}


def describe_env(name: str) -> str:
    if name not in os.environ:
        return "absent"
    value = os.environ[name].strip()
    if not value:
        return "present but empty"
    return f"set ({len(value)} chars)"


@app.get("/health")
def health():
    from triage_engine import DEFAULT_MODEL

    key = os.environ.get("GEMINI_API_KEY") or ""
    return {
        "status": "ok",
        "patients_loaded": len(BASELINE_PATIENTS),
        "gemini_configured": bool(key),
        "gemini_key_length": len(key),
        "model": os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL,
        "env": {name: describe_env(name) for name in EXPECTED_ENV_KEYS},
        "telephony_configured": telephony.is_configured(),
        "telephony_missing": telephony.missing_env_vars(),
        "runtime": os.environ.get("VERCEL_ENV", "local"),
    }
