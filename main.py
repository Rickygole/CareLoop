"""
CareLoop API.

Three routes, one job: let a voice agent connect to a patient's medication
data, triage what they report on the call, and book a follow-up.

    POST /portal/connect   patient_id -> derived dosing schedule
    POST /triage           transcript -> severity tier + reasoning
    POST /book             specialty + urgency -> appointment confirmation

All the clinical safety logic lives in triage_engine.py, which knows nothing
about HTTP. This file is transport only.
"""

import json
from pathlib import Path
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Load .env here, at the app entry point, BEFORE importing triage_engine.
# triage_engine stays dependency-free and just reads os.environ -- keeping it
# pure and standalone-testable. Populating that environ is this layer's job.
load_dotenv()

from triage_engine import Severity, triage

app = FastAPI(
    title="CareLoop API",
    description="Medication adherence voice agent with two-tier symptom triage.",
    version="0.1.0",
)

DATA_DIR = Path(__file__).parent / "mock_data"


# ---------------------------------------------------------------------------
# Mock FHIR-style patient store
# ---------------------------------------------------------------------------

def load_patients() -> Dict[str, dict]:
    """Load the mock patient records, keyed by patient_id.

    Stands in for a real FHIR Patient/MedicationRequest fetch from a portal.
    """
    with open(DATA_DIR / "patients.json") as f:
        records = json.load(f)["patients"]
    return {p["patient_id"]: p for p in records}


PATIENTS = load_patients()


# The clock times we map named dosing windows onto. A real build would pull
# these from the patient's own routine; for the demo they are fixed.
TIME_OF_DAY = {
    "morning": "08:00",
    "before breakfast": "07:30",
    "midday": "13:00",
    "afternoon": "15:00",
    "evening": "19:00",
    "bedtime": "22:00",
}


def derive_schedule(medication_requests: List[dict]) -> List[dict]:
    """Turn FHIR-ish MedicationRequests into a flat, call-ready dosing schedule.

    One entry per (medication, dose time), sorted by time -- which is the shape
    the voice agent actually needs to ask "did you take your 8am pill?"
    """
    schedule = []
    for req in medication_requests:
        if req.get("status") != "active":
            continue
        for window in [w.strip() for w in req["timing"].split(",")]:
            schedule.append(
                {
                    "medication": req["medication"],
                    "dosage": req["dosage"],
                    "window": window,
                    "time": TIME_OF_DAY.get(window, "as needed"),
                    "frequency": req["frequency"],
                    "prescriber": req["prescriber"],
                    "medication_request_id": req["id"],
                }
            )
    # "as needed" doses sort last; everything else by clock time.
    return sorted(schedule, key=lambda d: (d["time"] == "as needed", d["time"]))


# ---------------------------------------------------------------------------
# POST /portal/connect
# ---------------------------------------------------------------------------

class ConnectRequest(BaseModel):
    patient_id: str = Field(..., examples=["pt-1001"])


@app.post("/portal/connect")
def portal_connect(body: ConnectRequest):
    """Look up a patient and return their derived dosing schedule."""
    patient = PATIENTS.get(body.patient_id)
    if patient is None:
        raise HTTPException(
            status_code=404, detail=f"No patient with id {body.patient_id!r}"
        )

    return {
        "connected": True,
        "patient": {
            "patient_id": patient["patient_id"],
            "name": patient["name"],
            "phone": patient["phone"],
            "insurance_payer_id": patient["insurance_payer_id"],
        },
        "medication_count": len(patient["medication_requests"]),
        "schedule": derive_schedule(patient["medication_requests"]),
    }


# ---------------------------------------------------------------------------
# POST /triage
# ---------------------------------------------------------------------------

class TriageRequest(BaseModel):
    transcript: str = Field(..., examples=["my chest is killing me"])
    patient_id: Optional[str] = None


@app.post("/triage")
def triage_transcript(body: TriageRequest):
    """Run a symptom transcript through the two-tier triage engine."""
    result = triage(body.transcript)

    payload = result.to_dict()
    payload["patient_id"] = body.patient_id
    payload["transcript"] = body.transcript
    payload["recommended_action"] = (
        CRISIS_ACTION if result.is_crisis else RECOMMENDED_ACTION[result.severity]
    )
    return payload


# A mental health crisis is an EMERGENCY by severity, but answering it with
# "call 911 and hang up" is the wrong response and is contraindicated by most
# crisis guidance. It gets its own action: warm handoff, stay on the line.
CRISIS_ACTION = (
    "Route to the 988 Suicide and Crisis Lifeline (call or text 988). "
    "Stay on the line with the patient until a human is connected. "
    "Do NOT end the call."
)

RECOMMENDED_ACTION = {
    Severity.EMERGENCY: "Stop the check-in. Direct the patient to call 911 and "
                        "page the on-call clinician immediately.",
    Severity.SEVERE: "Book a same-day appointment and notify the prescriber.",
    Severity.MODERATE: "Book a clinician callback within 24 hours.",
    Severity.MILD: "Log the response and continue the normal check-in cadence.",
}


# ---------------------------------------------------------------------------
# POST /book
# ---------------------------------------------------------------------------

PROVIDERS = [
    {"provider_id": "prv-01", "name": "Dr. Aisha Rahman", "specialty": "internal medicine",
     "location": "Riverside Clinic, Suite 200"},
    {"provider_id": "prv-02", "name": "Dr. Lena Vogt", "specialty": "cardiology",
     "location": "Mercy Heart Center, 3rd Floor"},
    {"provider_id": "prv-03", "name": "Dr. Peter Okonjo", "specialty": "endocrinology",
     "location": "Riverside Clinic, Suite 410"},
    {"provider_id": "prv-04", "name": "Dr. Hannah Weiss", "specialty": "psychiatry",
     "location": "Lakeview Behavioral Health"},
    {"provider_id": "prv-05", "name": "Dr. Samuel Ortiz", "specialty": "pulmonology",
     "location": "Mercy Respiratory Care, 2nd Floor"},
]

# How fast we promise to see them, by urgency.
URGENCY_SLOTS = {
    "emergency": ("2026-09-18", "immediate - ER handoff"),
    "same_day": ("2026-09-18", "16:45"),
    "urgent": ("2026-09-19", "09:15"),
    "routine": ("2026-09-25", "11:30"),
}


class BookRequest(BaseModel):
    specialty: str = Field(..., examples=["cardiology"])
    urgency: str = Field("routine", examples=["urgent"])
    patient_id: Optional[str] = None


@app.post("/book")
def book_appointment(body: BookRequest):
    """Return a mock appointment confirmation from the static provider list."""
    specialty = body.specialty.strip().lower()
    urgency = body.urgency.strip().lower()

    if urgency not in URGENCY_SLOTS:
        raise HTTPException(
            status_code=400,
            detail=f"urgency must be one of {sorted(URGENCY_SLOTS)}",
        )

    provider = next((p for p in PROVIDERS if p["specialty"] == specialty), None)
    if provider is None:
        raise HTTPException(
            status_code=404,
            detail=f"No provider for specialty {body.specialty!r}. "
                   f"Available: {sorted({p['specialty'] for p in PROVIDERS})}",
        )

    date, time = URGENCY_SLOTS[urgency]
    return {
        "confirmed": True,
        "confirmation_code": f"CL-{provider['provider_id'][-2:]}-{urgency[:3].upper()}-7741",
        "patient_id": body.patient_id,
        "provider": provider,
        "urgency": urgency,
        "date": date,
        "time": time,
    }


@app.get("/health")
def health():
    return {"status": "ok", "patients_loaded": len(PATIENTS)}
