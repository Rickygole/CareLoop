import os
from datetime import datetime, timedelta, timezone
from typing import List, Optional

REMINDER_WINDOW_MINUTES = 90
LATE_AFTER_MINUTES = 120


def clinic_timezone() -> timezone:
    try:
        offset = float(os.environ.get("CARELOOP_UTC_OFFSET_HOURS", "-4"))
    except ValueError:
        offset = -4.0
    return timezone(timedelta(hours=offset))


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
    taken_ids = {
        entry.get("medication_id")
        for entry in patient.get("history", [])
        if entry.get("outcome") == "answered" and entry.get("taken")
    }

    doses = []
    for dose in dose_times_today(patient["medication_requests"], now):
        status = dose_status(dose["due_at"], now, dose["medication_id"] in taken_ids)
        doses.append({
            "medication": dose["medication"],
            "dosage": dose["dosage"],
            "medication_id": dose["medication_id"],
            "prescriber": dose["prescriber"],
            "time": dose["due_at"].strftime("%H:%M"),
            "due_at": dose["due_at"].isoformat(),
            "status": status,
        })

    next_dose = next((d for d in doses if d["status"] in ("upcoming", "due_soon", "due_now")), None)
    next_call = None
    if next_dose:
        due = datetime.fromisoformat(next_dose["due_at"])
        call_at = due if next_dose["status"] != "upcoming" else due - timedelta(minutes=0)
        next_call = {
            "at": call_at.isoformat(),
            "time": call_at.strftime("%H:%M"),
            "reason": f"Check in on {next_dose['medication']} {next_dose['dosage']}",
            "medication_id": next_dose["medication_id"],
        }

    return {
        "as_of": now.isoformat(),
        "doses": doses,
        "next_dose": next_dose,
        "next_call": next_call,
        "doses_taken": sum(1 for d in doses if d["status"] == "taken"),
        "doses_missed": sum(1 for d in doses if d["status"] == "missed"),
        "doses_total": len(doses),
    }
