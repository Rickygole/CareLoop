import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from providers import find_by_name

ALERT_PHONE_ENV = "ESCALATION_ALERT_PHONE"

ALERT_TIERS = {"emergency", "severe", "crisis"}

ALERT_SNIPPET_CHARS = 160

ESCALATION_IS_A_RECORD_ONLY = (
    "CareLoop does not notify a care team. These records describe what a "
    "deployed system would do. The acknowledgement windows are simulated "
    "timers with no recipient on the other end."
)

ESCALATION_ALERT_GOES_TO_ONE_PHONE = (
    "When an alert number is configured, the most serious tiers also send one "
    "text message to that single number. It belongs to the person running this "
    "demonstration, not to any clinician, and every patient in this system is "
    "invented."
)

NEVER_CONTACTS_EMERGENCY_SERVICES = (
    "This system never contacts emergency services on a patient's behalf "
    "because it has no verified address and no consent to do so."
)

ESCALATION_RULES = {
    "severe": {
        "notified_party": "on call clinician",
        "window": timedelta(minutes=30),
        "initial_ack_state": "pending",
    },
    "moderate": {
        "notified_party": "care team",
        "window": timedelta(hours=24),
        "initial_ack_state": "pending",
    },
    "emergency": {
        "notified_party": "on call clinician",
        "window": timedelta(minutes=5),
        "initial_ack_state": "pending",
    },
    "crisis": {
        "notified_party": "crisis line warm handoff (mocked)",
        "window": timedelta(minutes=0),
        "initial_ack_state": "acknowledged",
    },
}

_ESCALATIONS: Dict[str, List[dict]] = {}


def classify_kind(tier: str, is_crisis: bool) -> Optional[str]:
    if is_crisis:
        return "crisis"
    if tier in ESCALATION_RULES:
        return tier
    return None


def record_escalation(
    patient_id: str,
    tier: str,
    is_crisis: bool,
    fired_at: datetime,
    store: Optional[Dict[str, List[dict]]] = None,
) -> Optional[dict]:
    if store is None:
        store = _ESCALATIONS
    kind = classify_kind(tier, is_crisis)
    if kind is None:
        return None

    rule = ESCALATION_RULES[kind]
    ack_window_would_expire_at = fired_at + rule["window"]
    record = {
        "escalation_id": uuid.uuid4().hex,
        "patient_id": patient_id,
        "kind": kind,
        "fired_at": fired_at.isoformat(),
        "would_notify": rule["notified_party"],
        "notification_delivered": False,
        "notification_transport": "none",
        "alert_sms": None,
        "ack_window_would_expire_at": ack_window_would_expire_at.isoformat(),
        "ack_state": rule["initial_ack_state"],
        "mocked": kind == "crisis",
    }
    store.setdefault(patient_id, []).append(record)
    return record


def get_escalations(patient_id: str, store: Optional[Dict[str, List[dict]]] = None) -> List[dict]:
    if store is None:
        store = _ESCALATIONS
    return list(store.get(patient_id, []))


def ack_status(record: dict, now: datetime) -> str:
    if record["ack_state"] != "pending":
        return record["ack_state"]
    deadline = datetime.fromisoformat(record["ack_window_would_expire_at"])
    if now >= deadline:
        return "ack_window_elapsed_no_recipient"
    return "pending"


def unacknowledged_for_patient(
    patient_id: str, now: datetime, store: Optional[Dict[str, List[dict]]] = None
) -> List[dict]:
    if store is None:
        store = _ESCALATIONS
    out = []
    for record in get_escalations(patient_id, store):
        status = ack_status(record, now)
        if status == "ack_window_elapsed_no_recipient":
            out.append({**record, "status": status})
    return out


def reset_escalations(
    patient_id: Optional[str] = None, store: Optional[Dict[str, List[dict]]] = None
) -> None:
    if store is None:
        store = _ESCALATIONS
    if patient_id is None:
        store.clear()
    else:
        store.pop(patient_id, None)


def alert_phone() -> str:
    return (os.environ.get(ALERT_PHONE_ENV) or "").strip()


def wants_alert(kind: Optional[str]) -> bool:
    return kind in ALERT_TIERS


def assigned_provider(patient: dict) -> dict:
    prescribers = [
        request.get("prescriber")
        for request in patient.get("medication_requests", [])
        if request.get("status") == "active" and request.get("prescriber")
    ]
    for name in prescribers:
        listed = find_by_name(name)
        if listed:
            return {
                "provider_id": listed["provider_id"],
                "name": listed["name"],
                "specialty": listed["specialty"],
                "in_directory": True,
            }
    if prescribers:
        return {
            "provider_id": None,
            "name": prescribers[0],
            "specialty": None,
            "in_directory": False,
        }
    return {
        "provider_id": None,
        "name": "the on call clinician",
        "specialty": None,
        "in_directory": False,
    }


def _snippet(transcript: str) -> str:
    said = " ".join((transcript or "").split())
    said = said.replace('"', "'")
    if len(said) <= ALERT_SNIPPET_CHARS:
        return said
    return said[:ALERT_SNIPPET_CHARS].rstrip() + "..."


def compose_alert(
    patient_name: str, provider_name: str, kind: str, transcript: str, fired_at: datetime,
) -> str:
    stamp = fired_at.strftime("%d %b %Y, %I:%M %p %Z").replace(" 0", " ")
    return (
        "CareLoop demonstration alert. This is not a real clinical alert and "
        "the patient is invented.\n"
        f"{kind.upper()} for {patient_name}.\n"
        f"Assigned provider: {provider_name}.\n"
        f"At: {stamp}.\n"
        f'Patient said: "{_snippet(transcript)}"'
    )
