from typing import Iterable, List, Optional, Tuple

from providers import find_provider, next_available

SIMULATED_FRONT_DESK = True

FRONT_DESK_DISCLOSURE = (
    "The clinic side of this call is a simulated front desk operated by this "
    "project. No real medical office is contacted."
)


def clinic_call_script(
    provider: dict, patient_name: str, payer_display: str, reason: str, slot: str
) -> List[dict]:
    desk = f"{provider['name']}'s office"
    return [
        {"speaker": "careloop", "text":
            f"Hi, this is CareLoop calling on behalf of a patient, {patient_name}. "
            f"I'd like to book a follow-up with {provider['name']}."},
        {"speaker": "clinic", "text":
            f"{desk}, sure. What is the reason for the visit?"},
        {"speaker": "careloop", "text": reason},
        {"speaker": "clinic", "text":
            "And what insurance is the patient carrying?"},
        {"speaker": "careloop", "text": payer_display},
        {"speaker": "clinic", "text":
            f"We take that. I can offer {slot}."},
        {"speaker": "careloop", "text":
            "That works. Please book it and I will confirm with the patient."},
        {"speaker": "clinic", "text":
            f"Booked with {provider['name']} at {slot}. Nothing is sent from here."},
    ]


def reason_for_visit(tier: str, transcript: str) -> str:
    lead = {
        "severe": "The patient reported symptoms that need to be seen today.",
        "moderate": "The patient reported a symptom on their medication that warrants a follow-up.",
    }.get(tier, "Routine follow-up on medication tolerance.")
    return f"{lead} They described it as: {transcript.strip()}"


def plan_clinic_call(
    specialty: str, payer_id: Optional[str], payer_display: str,
    patient_name: str, tier: str, transcript: str,
    exclude: Optional[Iterable[Tuple[str, str]]] = None,
) -> Optional[dict]:
    choice = next_available(specialty, payer_id, exclude)
    if choice is None:
        provider = find_provider(specialty, payer_id)
        if provider is None or not provider["available_slots"]:
            return None
        excluded = set(exclude or ())
        remaining = [
            slot for slot in provider["available_slots"]
            if (provider["provider_id"], slot) not in excluded
        ]
        if not remaining:
            return None
        slot = sorted(remaining)[0]
    else:
        provider = choice["provider"]
        slot = choice["slot"]
    return {
        "provider": provider,
        "slot": slot,
        "simulated": SIMULATED_FRONT_DESK,
        "disclosure": FRONT_DESK_DISCLOSURE,
        "turns": clinic_call_script(
            provider, patient_name, payer_display,
            reason_for_visit(tier, transcript), slot,
        ),
    }
