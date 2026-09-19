import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional

ESCALATION_IS_A_RECORD_ONLY = (
    "CareLoop does not notify anyone. These records describe what a deployed "
    "system would do. No message, call, page or alert is sent to any person by "
    "this software, and the acknowledgement windows are simulated timers with "
    "no recipient on the other end."
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
        "notification_transport": "none, no recipient is configured in this prototype",
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
