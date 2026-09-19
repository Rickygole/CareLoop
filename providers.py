from typing import List, Optional

PROVIDERS: List[dict] = [
    {
        "provider_id": "prov1",
        "name": "Dr. Elena Vance",
        "specialty": "Internal Medicine",
        "accepted_payers": ["aetna-001", "carefirst-001"],
        "available_slots": ["2026-09-20T10:00:00Z", "2026-09-20T14:00:00Z"],
    },
    {
        "provider_id": "prov2",
        "name": "Dr. Raj Patel",
        "specialty": "Endocrinology",
        "accepted_payers": ["aetna-001", "united-001"],
        "available_slots": ["2026-09-21T09:00:00Z"],
    },
    {
        "provider_id": "prov3",
        "name": "Dr. Sarah Lin",
        "specialty": "Cardiology",
        "accepted_payers": ["carefirst-001", "united-001"],
        "available_slots": ["2026-09-20T11:00:00Z"],
    },
    {
        "provider_id": "prov4",
        "name": "Dr. Michael Brooks",
        "specialty": "Emergency Medicine",
        "accepted_payers": ["*"],
        "available_slots": [],
    },
]


def accepts_payer(provider: dict, payer_id: Optional[str]) -> bool:
    if "*" in provider["accepted_payers"]:
        return True
    return payer_id in provider["accepted_payers"]


def find_provider(specialty: str, payer_id: Optional[str]) -> Optional[dict]:
    wanted = (specialty or "").strip().lower()
    for provider in PROVIDERS:
        if provider["specialty"].lower() == wanted and accepts_payer(provider, payer_id):
            return provider
    return None


def specialties() -> List[str]:
    return sorted({p["specialty"] for p in PROVIDERS})
