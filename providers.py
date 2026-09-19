from typing import List, Optional

PROVIDERS: List[dict] = [
    {
        "provider_id": "prov1",
        "name": "Dr. Elena Vance",
        "specialty": "Internal Medicine",
        "accepted_payers": ["aetna-001", "carefirst-001"],
        "available_slots": ["2026-09-20T14:00:00Z", "2026-09-20T19:00:00Z", "2026-09-22T13:00:00Z"],
    },
    {
        "provider_id": "prov2",
        "name": "Dr. Raj Patel",
        "specialty": "Endocrinology",
        "accepted_payers": ["aetna-001", "united-001"],
        "available_slots": ["2026-09-21T13:30:00Z", "2026-09-21T18:00:00Z", "2026-09-23T14:30:00Z"],
    },
    {
        "provider_id": "prov3",
        "name": "Dr. Sarah Lin",
        "specialty": "Cardiology",
        "accepted_payers": ["carefirst-001", "united-001"],
        "available_slots": ["2026-09-20T15:15:00Z", "2026-09-22T16:00:00Z"],
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


def find_by_name(name: str) -> Optional[dict]:
    wanted = (name or "").strip().lower()
    if not wanted:
        return None
    for provider in PROVIDERS:
        if provider["name"].lower() == wanted:
            return provider
    return None


def find_provider(specialty: str, payer_id: Optional[str]) -> Optional[dict]:
    wanted = (specialty or "").strip().lower()
    for provider in PROVIDERS:
        if provider["specialty"].lower() == wanted and accepts_payer(provider, payer_id):
            return provider
    return None


def specialties() -> List[str]:
    return sorted({p["specialty"] for p in PROVIDERS})


def in_network(payer_id: Optional[str]) -> List[dict]:
    return [p for p in PROVIDERS if accepts_payer(p, payer_id) and p["available_slots"]]


def next_available(specialty: str, payer_id: Optional[str]) -> Optional[dict]:
    wanted = (specialty or "").strip().lower()
    options = []
    for provider in PROVIDERS:
        if provider["specialty"].lower() != wanted:
            continue
        if not accepts_payer(provider, payer_id):
            continue
        for slot in provider["available_slots"]:
            options.append({"provider": provider, "slot": slot})
    if not options:
        return None
    return sorted(options, key=lambda o: o["slot"])[0]


def network_summary(payer_id: Optional[str], payer_name: Optional[str] = None) -> dict:
    covered = in_network(payer_id)
    return {
        "payer_id": payer_id,
        "payer_name": payer_name,
        "in_network": [
            {
                "provider_id": p["provider_id"],
                "name": p["name"],
                "specialty": p["specialty"],
                "next_slot": sorted(p["available_slots"])[0] if p["available_slots"] else None,
                "slots_open": len(p["available_slots"]),
            }
            for p in covered
        ],
        "out_of_network": [
            {"name": p["name"], "specialty": p["specialty"]}
            for p in PROVIDERS
            if p not in covered and "*" not in p["accepted_payers"]
        ],
    }
