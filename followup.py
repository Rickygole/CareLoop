import re
from datetime import date, datetime, time, timedelta
from typing import List, Optional, Union

from clinic import FRONT_DESK_DISCLOSURE, SIMULATED_FRONT_DESK
from providers import accepts_payer, next_available, PROVIDERS
from scheduler import clinic_timezone

DEFAULT_HORIZON_DAYS = 120
DAY_BEFORE_HOUR = 18
SAME_DAY_HOUR = 8
SAME_DAY_MIN_LEAD_MINUTES = 120
WORDS_PER_MINUTE = 150.0
MAX_REMINDER_SECONDS = 45

AUTOMATED_CALL_DISCLOSURE = (
    "This is an automated call from CareLoop, not a person."
)
NO_ADVICE_LINE = (
    "This is a reminder only. Nothing about your medicines changes because of this call."
)

STATUS_BOOKED = "booked"
STATUS_UNBOOKABLE = "unbookable"
STATUS_UNPARSED = "unparsed"

ISSUE_NO_INTERVAL = "no_interval"
ISSUE_NO_IN_NETWORK_PROVIDER = "no_in_network_provider"
ISSUE_NO_SLOT_AFTER_DUE = "no_slot_on_or_after_due_date"

KIND_DAY_BEFORE = "day_before"
KIND_SAME_DAY = "same_day"

DAYS_PER_UNIT = {
    "day": 1,
    "week": 7,
    "month": 30,
    "year": 365,
}

NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

_NUMBER = r"(\d+|" + "|".join(NUMBER_WORDS) + r")"
_UNIT = r"(day|week|month|year)s?"
_CUE = r"(?:follow[\s\-]?up|followup|f/u|recheck|re-check|review|visit|return|repeat)"

_RANGE = re.compile(
    _NUMBER + r"\s*(?:-|to|or)\s*" + _NUMBER + r"\s*" + _UNIT,
    re.IGNORECASE,
)

_VAGUE = re.compile(
    r"\b(?:prn|as needed|as required|if needed|when needed|"
    r"a few|several|some|couple of|sometime|soon|"
    r"next visit|next appointment|per patient|at patient|"
    r"tbd|to be determined|unspecified)\b",
    re.IGNORECASE,
)

_PATTERNS = [
    re.compile(r"\bin\s+" + _NUMBER + r"\s*" + _UNIT + r"\b", re.IGNORECASE),
    re.compile(r"\bevery\s+" + _NUMBER + r"\s*" + _UNIT + r"\b", re.IGNORECASE),
    re.compile(_NUMBER + r"[\s\-]*" + _UNIT + r"[\s\-]*" + _CUE, re.IGNORECASE),
    re.compile(_CUE + r"[\s\-]*(?:at|after|in)?[\s\-]*" + _NUMBER + r"\s*" + _UNIT + r"\b", re.IGNORECASE),
]

_EVERY_BARE = re.compile(r"\bevery\s+" + _UNIT + r"\b", re.IGNORECASE)
_ANNUAL = re.compile(r"\b(annually|annual|yearly)\b", re.IGNORECASE)


def _to_number(token: str) -> Optional[int]:
    token = token.strip().lower()
    if token.isdigit():
        value = int(token)
        return value if value > 0 else None
    return NUMBER_WORDS.get(token)


def parse_interval(text: Optional[str]) -> Optional[int]:
    if not text:
        return None
    if _VAGUE.search(text) or _RANGE.search(text):
        return None

    best: Optional[tuple] = None

    for pattern in _PATTERNS:
        for match in pattern.finditer(text):
            groups = [g for g in match.groups() if g is not None]
            if len(groups) < 2:
                continue
            number_token, unit_token = groups[0], groups[1]
            if unit_token.lower().rstrip("s") not in DAYS_PER_UNIT:
                number_token, unit_token = groups[1], groups[0]
            count = _to_number(number_token)
            unit = DAYS_PER_UNIT.get(unit_token.lower().rstrip("s"))
            if count is None or unit is None:
                continue
            candidate = (match.start(), count * unit)
            if best is None or candidate[0] < best[0]:
                best = candidate

    for pattern in (_EVERY_BARE, _ANNUAL):
        match = pattern.search(text)
        if match is None:
            continue
        if pattern is _ANNUAL:
            days = DAYS_PER_UNIT["year"]
        else:
            days = DAYS_PER_UNIT.get(match.group(1).lower().rstrip("s"))
        if days is None:
            continue
        candidate = (match.start(), days)
        if best is None or candidate[0] < best[0]:
            best = candidate

    return best[1] if best else None


def _as_date(value: Union[str, date, datetime, None]) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(clinic_timezone()).date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text).astimezone(clinic_timezone()).date()
    except ValueError:
        pass
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _parse_slot(slot: str) -> datetime:
    text = slot.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=clinic_timezone())
    return parsed.astimezone(clinic_timezone())


def _start_of_day(day: date) -> datetime:
    return datetime.combine(day, time(0, 0), tzinfo=clinic_timezone())


def note_interval_days(note: dict) -> Optional[int]:
    explicit = note.get("interval_days")
    if isinstance(explicit, int) and explicit > 0:
        return explicit
    return parse_interval(note.get("text"))


def due_date(note: dict, today: Union[str, date, datetime, None] = None) -> Optional[date]:
    interval = note_interval_days(note)
    if interval is None:
        return None
    authored = _as_date(note.get("authored_on"))
    if authored is None:
        authored = _as_date(today)
    if authored is None:
        return None
    return authored + timedelta(days=interval)


def _format_day(moment: datetime) -> str:
    return f"{moment:%A, %B} {moment.day}"


def _format_time(moment: datetime) -> str:
    hour = moment.hour % 12 or 12
    meridiem = "AM" if moment.hour < 12 else "PM"
    return f"{hour}:{moment.minute:02d} {meridiem}"


def format_slot(slot: str) -> str:
    moment = _parse_slot(slot)
    return f"{_format_day(moment)} at {_format_time(moment)}"


def _candidate_slots(specialty: str, payer_id: Optional[str]) -> List[dict]:
    wanted = (specialty or "").strip().lower()
    options = []
    for provider in PROVIDERS:
        if provider["specialty"].lower() != wanted:
            continue
        if not accepts_payer(provider, payer_id):
            continue
        for slot in provider["available_slots"]:
            options.append({"provider": provider, "slot": slot})
    return sorted(options, key=lambda o: o["slot"])


def next_slot_on_or_after(
    specialty: str, payer_id: Optional[str], earliest: datetime
) -> Optional[dict]:
    soonest = next_available(specialty, payer_id)
    if soonest is None:
        return None
    if _parse_slot(soonest["slot"]) >= earliest:
        return soonest
    for option in _candidate_slots(specialty, payer_id):
        if _parse_slot(option["slot"]) >= earliest:
            return option
    return None


def visit_reason(note: dict) -> str:
    text = (note.get("text") or "").strip()
    prescriber = note.get("prescriber") or "the prescriber"
    if not text:
        return f"Follow-up requested by {prescriber}."
    if not text.endswith("."):
        text = text + "."
    return f"{prescriber} wrote: {text}"


def _base_visit(patient: dict, note: dict) -> dict:
    name = patient.get("name") or ""
    return {
        "patient_id": patient.get("patient_id"),
        "patient_name": name,
        "patient_first_name": name.split(" ")[0] if name else "",
        "phone": patient.get("phone"),
        "note_id": note.get("note_id"),
        "note": note,
        "note_text": note.get("text"),
        "prescriber": note.get("prescriber"),
        "authored_on": note.get("authored_on"),
        "specialty": note.get("specialty"),
        "reason": visit_reason(note),
        "payer_id": patient.get("insurance_payer_id"),
        "payer_display": patient.get("insurance_display_name"),
        "interval_days": None,
        "due_date": None,
        "status": STATUS_UNPARSED,
        "provider": None,
        "provider_name": None,
        "slot": None,
        "slot_local": None,
        "starts_at": None,
        "in_network": False,
        "simulated": SIMULATED_FRONT_DESK,
        "disclosure": FRONT_DESK_DISCLOSURE,
        "issue": ISSUE_NO_INTERVAL,
        "issue_detail": None,
    }


def plan_followups(
    patient: dict,
    today: Union[str, date, datetime, None] = None,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> List[dict]:
    anchor_day = _as_date(today)
    payer_id = patient.get("insurance_payer_id")
    payer_display = patient.get("insurance_display_name")
    visits = []

    for note in patient.get("care_plan_notes", []) or []:
        if note.get("status", "active") != "active":
            continue

        visit = _base_visit(patient, note)
        interval = note_interval_days(note)

        if interval is None:
            visit["issue_detail"] = "No follow-up interval could be read from the note."
            visits.append(visit)
            continue

        visit["interval_days"] = interval
        due = due_date(note, anchor_day)
        if due is None:
            visit["issue_detail"] = "The note has no usable authored date."
            visits.append(visit)
            continue

        visit["due_date"] = due.isoformat()

        if anchor_day is not None and horizon_days is not None:
            if due > anchor_day + timedelta(days=horizon_days):
                continue

        earliest = _start_of_day(due)
        if anchor_day is not None:
            earliest = max(earliest, _start_of_day(anchor_day))

        specialty = note.get("specialty") or ""
        choice = next_slot_on_or_after(specialty, payer_id, earliest)

        if choice is None:
            visit["status"] = STATUS_UNBOOKABLE
            if next_available(specialty, payer_id) is None:
                visit["issue"] = ISSUE_NO_IN_NETWORK_PROVIDER
                visit["issue_detail"] = (
                    f"No {specialty} provider in network for "
                    f"{payer_display or payer_id or 'this payer'}."
                )
            else:
                visit["issue"] = ISSUE_NO_SLOT_AFTER_DUE
                visit["issue_detail"] = (
                    f"No in-network {specialty} slot open on or after "
                    f"{due.isoformat()}."
                )
            visits.append(visit)
            continue

        provider = choice["provider"]
        visit["status"] = STATUS_BOOKED
        visit["provider"] = provider
        visit["provider_name"] = provider["name"]
        visit["slot"] = choice["slot"]
        visit["starts_at"] = _parse_slot(choice["slot"]).isoformat()
        visit["slot_local"] = format_slot(choice["slot"])
        visit["in_network"] = True
        visit["issue"] = None
        visits.append(visit)

    return sorted(visits, key=lambda v: (v["slot"] or "", v["due_date"] or "", v["note_id"] or ""))


def _article(word: str) -> str:
    return "an" if word[:1].upper() in "AEIOU" else "a"


def spoken_seconds(text: str) -> float:
    words = len(text.split())
    return round(words / WORDS_PER_MINUTE * 60.0, 1)


def spoken_reminder(visit: dict, kind: str, patient_first_name: Optional[str] = None) -> str:
    first_name = patient_first_name or visit.get("patient_first_name") or "there"
    provider_name = visit.get("provider_name") or "your provider"
    specialty = visit.get("specialty") or "follow-up"
    when = visit.get("slot_local") or "a time the clinic confirmed"
    lead = "tomorrow" if kind == KIND_DAY_BEFORE else "today"
    note_text = (visit.get("note_text") or "").strip().rstrip(".")
    prescriber = visit.get("prescriber") or "your prescriber"

    parts = [
        f"Hello {first_name}. {AUTOMATED_CALL_DISCLOSURE}",
        f"You have {_article(specialty)} {specialty} visit {lead}, {when}, with {provider_name}.",
    ]
    if note_text:
        parts.append(f"CareLoop booked it because {prescriber} wrote: {note_text}.")
    else:
        parts.append(f"CareLoop booked it at the request of {prescriber}.")
    parts.append(NO_ADVICE_LINE)
    parts.append("If the time does not work, call the clinic and they will move it.")
    return " ".join(parts)


def _reminder_time(visit_at: datetime, kind: str) -> datetime:
    if kind == KIND_DAY_BEFORE:
        day_before = (visit_at - timedelta(days=1)).date()
        return datetime.combine(day_before, time(DAY_BEFORE_HOUR, 0), tzinfo=clinic_timezone())
    morning = datetime.combine(visit_at.date(), time(SAME_DAY_HOUR, 0), tzinfo=clinic_timezone())
    latest = visit_at - timedelta(minutes=SAME_DAY_MIN_LEAD_MINUTES)
    return min(morning, latest)


def reminder_plan(visit: dict, now: Union[str, datetime, None] = None) -> List[dict]:
    if visit.get("status") != STATUS_BOOKED or not visit.get("slot"):
        return []

    visit_at = _parse_slot(visit["slot"])

    if isinstance(now, str):
        moment = _parse_slot(now)
    elif isinstance(now, datetime):
        moment = now.astimezone(clinic_timezone()) if now.tzinfo else now.replace(
            tzinfo=clinic_timezone()
        )
    else:
        moment = None

    reminders = []
    for kind in (KIND_DAY_BEFORE, KIND_SAME_DAY):
        fire_at = _reminder_time(visit_at, kind)
        if fire_at >= visit_at:
            continue
        if moment is not None and fire_at <= moment:
            continue
        reminders.append({
            "kind": kind,
            "fire_at": fire_at.isoformat(),
            "note_id": visit.get("note_id"),
            "patient_id": visit.get("patient_id"),
            "phone": visit.get("phone"),
            "visit_at": visit_at.isoformat(),
            "visit_local": visit.get("slot_local"),
            "provider_name": visit.get("provider_name"),
            "specialty": visit.get("specialty"),
            "script": spoken_reminder(visit, kind, visit.get("patient_first_name")),
            "automated_disclosure": AUTOMATED_CALL_DISCLOSURE,
        })

    return reminders


def plan_with_reminders(
    patient: dict,
    today: Union[str, date, datetime, None] = None,
    now: Union[str, datetime, None] = None,
    horizon_days: int = DEFAULT_HORIZON_DAYS,
) -> List[dict]:
    planned = []
    for visit in plan_followups(patient, today, horizon_days):
        entry = dict(visit)
        entry["reminders"] = reminder_plan(visit, now)
        planned.append(entry)
    return planned
