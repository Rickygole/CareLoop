import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


load_dotenv()

from providers import find_provider, specialties
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

DATA_DIR = Path(__file__).parent / "mock_data"
WEBHOOK_SECRET = os.environ.get("CARELOOP_WEBHOOK_SECRET", "")


def load_patients() -> Dict[str, dict]:
    with open(DATA_DIR / "patients.json") as f:
        return {p["patient_id"]: p for p in json.load(f)["patients"]}


PATIENTS = load_patients()


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

    def since(self, seq: int) -> List[dict]:
        return [e for e in self._events if e["seq"] > seq]

    def connect(self, ws: WebSocket) -> None:
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._clients:
            self._clients.remove(ws)


bus = TraceBus()


@app.websocket("/trace")
async def trace_socket(ws: WebSocket, token: str = Query(default="")):
    if WEBHOOK_SECRET and token != WEBHOOK_SECRET:
        await ws.close(code=1008)
        return
    await ws.accept()
    bus.connect(ws)
    try:
        for event in bus.since(0):
            await ws.send_json(event)
        while True:
            await asyncio.sleep(30)
            await ws.send_json({"event_type": "PING", "payload": {}})
    except WebSocketDisconnect:
        bus.disconnect(ws)
    except Exception:
        bus.disconnect(ws)


@app.get("/trace/events")
def trace_events(since: int = 0):
    return {"events": bus.since(since)}


class ConnectRequest(BaseModel):
    patient_id: str = Field(..., examples=["p1"])


@app.post("/portal/connect")
async def portal_connect(body: ConnectRequest):
    patient = PATIENTS.get(body.patient_id)
    if patient is None:
        raise HTTPException(404, f"No patient with id {body.patient_id!r}")

    patient = dict(patient)
    patient["connected"] = True
    patient["connected_at"] = datetime.now(timezone.utc).isoformat()
    PATIENTS[body.patient_id] = patient

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


async def run_triage(transcript: str, patient_id: Optional[str] = None) -> dict:
    await bus.emit("PATIENT_SPEECH", {"text": transcript, "patient_id": patient_id})
    await bus.emit("TIER_0_CHECK", {"transcript": transcript})

    result = triage(transcript)

    if result.matched_rules:
        await bus.emit("TIER_0_MATCH", {"rules": result.matched_rules})
    if result.normalized_text:
        await bus.emit("NORMALIZE", {"normalized_text": result.normalized_text})
    if result.tier == "tier_1":
        await bus.emit(
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
        await bus.emit(
            "EMERGENCY_ESCALATION",
            {
                "rules": result.matched_rules,
                "is_crisis": result.is_crisis,
            },
        )
    await bus.emit("ACTION_DECIDED", {"tier": payload["tier"]})
    return payload


@app.post("/triage")
async def triage_transcript(body: TriageRequest):
    return await run_triage(body.transcript, body.patient_id)


URGENCIES = {"routine", "urgent"}


class BookRequest(BaseModel):
    specialty: str = Field(..., examples=["Internal Medicine"])
    urgency: str = Field("routine", examples=["routine"])
    patient_id: Optional[str] = None


@app.post("/book")
async def book_appointment(body: BookRequest):
    urgency = body.urgency.strip().lower()
    if urgency not in URGENCIES:
        raise HTTPException(400, f"urgency must be one of {sorted(URGENCIES)}")

    patient = PATIENTS.get(body.patient_id) if body.patient_id else None
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
    await bus.emit(
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
async def elevenlabs_webhook(body: ToolCall):
    if WEBHOOK_SECRET and body.secret != WEBHOOK_SECRET:
        raise HTTPException(401, "unauthorized")

    if body.patient_id and body.patient_id not in PATIENTS:
        raise HTTPException(404, "unknown_patient")

    await bus.emit("TOOL_CALL", {"tool": body.tool_name, "patient_id": body.patient_id})

    if body.tool_name == "report_symptom":
        return await run_triage(body.transcript or "", body.patient_id)

    if body.tool_name == "book_appointment":
        return await book_appointment(
            BookRequest(
                specialty=body.specialty or "Internal Medicine",
                urgency=body.urgency or "routine",
                patient_id=body.patient_id,
            )
        )

    raise HTTPException(400, f"unknown tool {body.tool_name!r}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "patients_loaded": len(PATIENTS),
        "gemini_configured": bool(os.environ.get("GEMINI_API_KEY")),
    }
