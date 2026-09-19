import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

REMINDER_WINDOW_MINUTES = 90
LATE_AFTER_MINUTES = 120
COALESCE_WINDOW_MINUTES = 60
DEFAULT_CONTACT_WINDOW = {"start": "08:00", "end": "20:00"}


def clinic_timezone() -> timezone:
    try:
        offset = float(os.environ.get("CARELOOP_UTC_OFFSET_HOURS", "-4"))
    except ValueError:
        offset = -4.0
    return timezone(timedelta(hours=offset))


def _parse_hhmm(text: str, fallback: int) -> int:
    try:
        return int(str(text).split(":")[0])
    except (ValueError, AttributeError, IndexError):
        return fallback


def contact_window(patient: dict) -> dict:
    window = patient.get("preferred_contact_window") or DEFAULT_CONTACT_WINDOW
    return {
        "start_hour": _parse_hhmm(window.get("start"), 8),
        "end_hour": _parse_hhmm(window.get("end"), 20),
        "start": window.get("start", DEFAULT_CONTACT_WINDOW["start"]),
        "end": window.get("end", DEFAULT_CONTACT_WINDOW["end"]),
    }


def clamp_to_window(moment: datetime, window: dict) -> tuple:
    if moment.hour < window["start_hour"]:
        return moment.replace(hour=window["start_hour"], minute=0), True
    if moment.hour > window["end_hour"]:
        return moment.replace(hour=window["end_hour"], minute=0), True
    return moment, False


STATUS_RANK = {"taken": 0, "upcoming": 1, "due_soon": 2, "due_now": 3, "missed": 4}


def _hour_of(entry: dict) -> str:
    stamp = str(entry.get("timestamp", ""))
    hour = entry.get("dose_hour")
    if hour is not None:
        return f"{int(hour):02d}"
    if len(stamp) >= 13 and stamp[10] == "T":
        naive = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        if naive.tzinfo is not None:
            naive = naive.astimezone(clinic_timezone())
        return naive.strftime("%H")
    return ""


def coalesce(doses: List[dict]) -> List[dict]:
    groups = []
    for dose in doses:
        due = datetime.fromisoformat(dose["due_at"])
        placed = False
        for group in groups:
            gap = abs((due - datetime.fromisoformat(group["at"])).total_seconds()) / 60
            if gap <= COALESCE_WINDOW_MINUTES:
                group["medications"].append(dose["medication"])
                group["medication_ids"].append(dose["medication_id"])
                group["member_statuses"].append(dose["status"])
                placed = True
                break
        if not placed:
            groups.append({
                "at": dose["due_at"],
                "time": dose["time"],
                "status": dose["status"],
                "medications": [dose["medication"]],
                "medication_ids": [dose["medication_id"]],
                "member_statuses": [dose["status"]],
            })
    for group in groups:
        group["covers"] = len(group["medications"])
        group["status"] = max(
            group["member_statuses"], key=lambda st: STATUS_RANK.get(st, 0)
        )
        del group["member_statuses"]
    return groups


def clinic_now() -> datetime:
    return datetime.now(clinic_timezone())


def dose_times_today(medication_requests: List[dict], now: datetime) -> List[dict]:
    doses = []
    for request in medication_requests:
        if request.get("status") != "active":
            continue
        for hour in request["timing"]["preferred_hours"]:
            due = now.replace(hour=hour, minute=0, second=0, microsecond=0)
            doses.append({
                "medication": request["medication"],
                "dosage": request["dosage_text"],
                "medication_id": request["medication_id"],
                "prescriber": request["prescriber"],
                "due_at": due,
            })
    return sorted(doses, key=lambda d: d["due_at"])


def dose_status(due_at: datetime, now: datetime, taken: bool) -> str:
    if taken:
        return "taken"
    minutes_late = (now - due_at).total_seconds() / 60
    if minutes_late < -REMINDER_WINDOW_MINUTES:
        return "upcoming"
    if minutes_late < 0:
        return "due_soon"
    if minutes_late <= LATE_AFTER_MINUTES:
        return "due_now"
    return "missed"


def build_day_plan(patient: dict, now: Optional[datetime] = None) -> dict:
    now = now.astimezone(clinic_timezone()) if now else clinic_now()
    today = now.date().isoformat()
    taken_doses = set()
    for entry in patient.get("history", []):
        if entry.get("outcome") != "answered" or not entry.get("taken"):
            continue
        stamp = str(entry.get("timestamp", ""))
        if stamp[:10] != today:
            continue
        taken_doses.add((entry.get("medication_id"), _hour_of(entry)))

    doses = []
    for dose in dose_times_today(patient["medication_requests"], now):
        key = (dose["medication_id"], dose["due_at"].strftime("%H"))
        status = dose_status(dose["due_at"], now, key in taken_doses)
        doses.append({
            "medication": dose["medication"],
            "dosage": dose["dosage"],
            "medication_id": dose["medication_id"],
            "prescriber": dose["prescriber"],
            "time": dose["due_at"].strftime("%H:%M"),
            "due_at": dose["due_at"].isoformat(),
            "status": status,
        })

    window = contact_window(patient)
    calls = coalesce(doses)
    for call in calls:
        moved_at, moved = clamp_to_window(datetime.fromisoformat(call["at"]), window)
        call["at"] = moved_at.isoformat()
        call["time"] = moved_at.strftime("%H:%M")
        call["moved_into_contact_window"] = moved

    next_dose = next((d for d in doses if d["status"] in ("upcoming", "due_soon", "due_now")), None)
    next_call = None
    if next_dose:
        group = next(
            (c for c in calls if next_dose["medication_id"] in c["medication_ids"]), None
        )
        call_at = datetime.fromisoformat(group["at"]) if group else datetime.fromisoformat(next_dose["due_at"])
        covers = group["medications"] if group else [next_dose["medication"]]
        reason = (
            f"Check in on {next_dose['medication']} {next_dose['dosage']}"
            if len(covers) == 1
            else "Check in on " + ", ".join(covers[:-1]) + " and " + covers[-1]
        )
        next_call = {
            "at": call_at.isoformat(),
            "time": call_at.strftime("%H:%M"),
            "reason": reason,
            "medication_id": next_dose["medication_id"],
            "covers": covers,
            "moved_into_contact_window": bool(group and group["moved_into_contact_window"]),
        }

    return {
        "as_of": now.isoformat(),
        "doses": doses,
        "next_dose": next_dose,
        "next_call": next_call,
        "doses_taken": sum(1 for d in doses if d["status"] == "taken"),
        "doses_missed": sum(1 for d in doses if d["status"] == "missed"),
        "doses_total": len(doses),
        "calls": calls,
        "calls_total": len(calls),
        "contact_window": {"start": window["start"], "end": window["end"]},
    }
