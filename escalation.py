import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

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


def record_escalation(patient_id: str, tier: str, is_crisis: bool, fired_at: datetime) -> Optional[dict]:
    kind = classify_kind(tier, is_crisis)
    if kind is None:
        return None

    rule = ESCALATION_RULES[kind]
    ack_required_by = fired_at + rule["window"]
    record = {
        "escalation_id": uuid.uuid4().hex,
        "patient_id": patient_id,
        "kind": kind,
        "fired_at": fired_at.isoformat(),
        "notified_party": rule["notified_party"],
        "ack_required_by": ack_required_by.isoformat(),
        "ack_state": rule["initial_ack_state"],
        "mocked": kind == "crisis",
    }
    _ESCALATIONS.setdefault(patient_id, []).append(record)
    return record


def get_escalations(patient_id: str) -> List[dict]:
    return list(_ESCALATIONS.get(patient_id, []))


def ack_status(record: dict, now: datetime) -> str:
    if record["ack_state"] != "pending":
        return record["ack_state"]
    deadline = datetime.fromisoformat(record["ack_required_by"])
    if now >= deadline:
        return "unacknowledged_emergency"
    return "pending"


def unacknowledged_for_patient(patient_id: str, now: datetime) -> List[dict]:
    out = []
    for record in get_escalations(patient_id):
        status = ack_status(record, now)
        if status == "unacknowledged_emergency":
            out.append({**record, "status": status})
    return out


def reset_escalations(patient_id: Optional[str] = None) -> None:
    if patient_id is None:
        _ESCALATIONS.clear()
    else:
        _ESCALATIONS.pop(patient_id, None)
