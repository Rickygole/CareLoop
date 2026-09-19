import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import followup
from providers import accepts_payer, specialties
from scheduler import clinic_timezone

ROOT = Path(__file__).resolve().parent.parent
TODAY = date(2026, 9, 19)


def load_patient(patient_id):
    with open(ROOT / "mock_data" / "patients.json") as f:
        patients = json.load(f)["patients"]
    return next(p for p in patients if p["patient_id"] == patient_id)


def make_patient(payer_id, notes, name="Test Patient"):
    return {
        "patient_id": "ptest",
        "name": name,
        "phone": "+15551234999",
        "insurance_payer_id": payer_id,
        "insurance_display_name": "Test Payer",
        "medication_requests": [],
        "care_plan_notes": notes,
    }


def make_note(text, specialty="Cardiology", authored_on="2026-09-19", note_id="n1"):
    return {
        "note_id": note_id,
        "authored_on": authored_on,
        "prescriber": "Dr. Raj Patel",
        "specialty": specialty,
        "status": "active",
        "text": text,
    }


def local(year, month, day, hour=0, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=clinic_timezone())


@pytest.mark.parametrize("text,expected", [
    ("Recheck BMP in 10 days.", 10),
    ("Blood pressure review in 3 weeks.", 21),
    ("Recheck A1c in 3 months.", 90),
    ("Recheck A1c in three months.", 90),
    ("4 week follow up on lisinopril.", 28),
    ("3-month follow-up for diabetes.", 90),
    ("Recheck in 6 months with labs.", 180),
    ("Repeat A1c annually.", 365),
    ("Check A1c every 3 months while on metformin.", 90),
    ("Blood pressure check every month.", 30),
    ("Kidney function review in 1 year.", 365),
])
def test_parse_interval_reads_supported_phrasings(text, expected):
    assert followup.parse_interval(text) == expected


@pytest.mark.parametrize("text", [
    "Patient doing well, continue current dose.",
    "Follow up prn.",
    "Recheck A1c as needed.",
    "Repeat labs in 6 to 12 months.",
    "Recheck at the next visit.",
    "Started metformin 3 months ago, tolerating well.",
    "",
    None,
])
def test_parse_interval_refuses_to_guess(text):
    assert followup.parse_interval(text) is None


def test_parse_interval_takes_the_first_interval_stated():
    text = "Recheck A1c in 3 months, then annually."
    assert followup.parse_interval(text) == 90


def test_due_date_adds_the_interval_to_the_authored_date():
    note = make_note("Recheck A1c in 3 months.", authored_on="2026-06-22")
    assert followup.due_date(note, TODAY) == date(2026, 9, 20)


def test_due_date_is_none_without_an_interval():
    note = make_note("Continue current dose.", authored_on="2026-06-22")
    assert followup.due_date(note, TODAY) is None


def test_booked_visit_uses_an_in_network_provider_at_or_after_the_due_date():
    visits = followup.plan_followups(load_patient("p1"), TODAY)
    visit = next(v for v in visits if v["note_id"] == "cpn1")

    assert visit["status"] == "booked"
    assert visit["specialty"] == "Endocrinology"
    assert visit["provider"]["specialty"] == "Endocrinology"
    assert accepts_payer(visit["provider"], "aetna-001")
    assert visit["payer_id"] == "aetna-001"
    assert visit["issue"] is None
    assert followup._parse_slot(visit["slot"]) >= followup._start_of_day(date(2026, 9, 20))
    assert "Recheck A1c in 3 months" in visit["reason"]


def test_earlier_slot_before_the_due_date_is_not_used():
    patient = load_patient("p2")
    visit = next(v for v in followup.plan_followups(patient, TODAY) if v["note_id"] == "cpn2")

    assert visit["status"] == "booked"
    assert visit["slot"] == "2026-09-22T16:00:00Z"
    assert accepts_payer(visit["provider"], "carefirst-001")


def test_payer_with_no_in_network_specialist_is_unbookable_not_out_of_network():
    patient = load_patient("p2")
    visit = next(v for v in followup.plan_followups(patient, TODAY) if v["note_id"] == "cpn3")

    assert visit["status"] == "unbookable"
    assert visit["issue"] == "no_in_network_provider"
    assert visit["provider"] is None
    assert visit["slot"] is None
    assert "Endocrinology" in visit["issue_detail"]


def test_overdue_note_books_the_next_slot_and_never_one_in_the_past():
    patient = make_patient("carefirst-001", [
        make_note("Blood pressure review in 4 weeks.", authored_on="2026-01-05"),
    ])
    visit = followup.plan_followups(patient, TODAY)[0]

    assert visit["due_date"] == "2026-02-02"
    assert visit["status"] == "booked"
    assert followup._parse_slot(visit["slot"]) >= followup._start_of_day(TODAY)
    assert visit["slot"] == "2026-09-20T15:15:00Z"


def test_note_due_after_every_open_slot_is_unbookable():
    patient = make_patient("carefirst-001", [
        make_note("Blood pressure review in 3 weeks.", authored_on="2026-09-19"),
    ])
    visit = followup.plan_followups(patient, TODAY)[0]

    assert visit["status"] == "unbookable"
    assert visit["issue"] == "no_slot_on_or_after_due_date"
    assert visit["slot"] is None


def test_note_without_an_interval_is_surfaced_not_dropped():
    patient = make_patient("aetna-001", [
        make_note("Patient doing well, continue current dose.", specialty="Endocrinology"),
    ])
    visits = followup.plan_followups(patient, TODAY)

    assert len(visits) == 1
    assert visits[0]["status"] == "unparsed"
    assert visits[0]["issue"] == "no_interval"
    assert visits[0]["due_date"] is None
    assert visits[0]["slot"] is None


def test_notes_beyond_the_horizon_are_left_alone():
    patient = make_patient("aetna-001", [
        make_note("Recheck A1c in 6 months.", specialty="Endocrinology"),
    ])

    assert followup.plan_followups(patient, TODAY, horizon_days=30) == []
    assert len(followup.plan_followups(patient, TODAY, horizon_days=365)) == 1


def test_inactive_notes_are_skipped():
    note = make_note("Recheck in 2 weeks.", authored_on="2026-09-10")
    note["status"] = "completed"

    assert followup.plan_followups(make_patient("carefirst-001", [note]), TODAY) == []


def test_both_reminders_land_the_evening_before_and_the_morning_of():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )
    reminders = followup.reminder_plan(visit, local(2026, 9, 19, 9, 0))

    assert [r["kind"] for r in reminders] == ["day_before", "same_day"]
    assert reminders[0]["fire_at"] == local(2026, 9, 21, 18, 0).isoformat()
    assert reminders[1]["fire_at"] == local(2026, 9, 22, 8, 0).isoformat()
    assert all(r["visit_at"] == visit["starts_at"] for r in reminders)
    assert all(r["phone"] == visit["phone"] for r in reminders)


def test_day_before_reminder_is_suppressed_once_that_hour_has_passed():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )
    reminders = followup.reminder_plan(visit, local(2026, 9, 21, 19, 30))

    assert [r["kind"] for r in reminders] == ["same_day"]


def test_no_reminders_remain_once_the_visit_is_under_way():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )

    assert followup.reminder_plan(visit, local(2026, 9, 22, 12, 30)) == []


def test_same_day_reminder_keeps_a_lead_before_an_early_visit():
    visit = next(
        v for v in followup.plan_followups(load_patient("p1"), TODAY)
        if v["note_id"] == "cpn1"
    )
    same_day = next(
        r for r in followup.reminder_plan(visit, local(2026, 9, 19, 9, 0))
        if r["kind"] == "same_day"
    )
    fire_at = datetime.fromisoformat(same_day["fire_at"])
    visit_at = datetime.fromisoformat(same_day["visit_at"])

    assert fire_at < visit_at
    assert visit_at - fire_at >= timedelta(minutes=followup.SAME_DAY_MIN_LEAD_MINUTES)


def test_unbookable_visit_gets_no_reminder_calls():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn3"
    )

    assert followup.reminder_plan(visit, local(2026, 9, 19, 9, 0)) == []


def test_naive_now_does_not_crash_the_reminder_plan():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )

    assert len(followup.reminder_plan(visit, datetime(2026, 9, 19, 9, 0))) == 2


def test_spoken_reminder_names_the_patient_provider_time_and_discloses_automation():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )
    line = followup.spoken_reminder(visit, "day_before", "Dorothy")

    assert line.startswith("Hello Dorothy")
    assert "Dr. Sarah Lin" in line
    assert "Cardiology" in line
    assert "Tuesday, September 22" in line
    assert "12:00 PM" in line
    assert followup.AUTOMATED_CALL_DISCLOSURE in line
    assert "Blood pressure review in 4 weeks" in line
    assert followup.NO_ADVICE_LINE in line


def test_spoken_reminder_says_tomorrow_or_today_by_kind():
    visit = next(
        v for v in followup.plan_followups(load_patient("p1"), TODAY)
        if v["note_id"] == "cpn1"
    )

    assert "visit tomorrow" in followup.spoken_reminder(visit, "day_before", "Maria")
    assert "visit today" in followup.spoken_reminder(visit, "same_day", "Maria")


def test_spoken_reminder_stays_inside_the_call_budget():
    for patient_id in ("p1", "p2"):
        for visit in followup.plan_followups(load_patient(patient_id), TODAY):
            if visit["status"] != "booked":
                continue
            for kind in ("day_before", "same_day"):
                line = followup.spoken_reminder(visit, kind, visit["patient_first_name"])
                assert followup.spoken_seconds(line) < followup.MAX_REMINDER_SECONDS


def test_plan_with_reminders_wires_visits_and_calls_together():
    plans = followup.plan_with_reminders(
        load_patient("p1"), TODAY, local(2026, 9, 19, 9, 0)
    )

    assert len(plans) == 1
    assert plans[0]["status"] == "booked"
    assert [r["kind"] for r in plans[0]["reminders"]] == ["day_before", "same_day"]


def test_care_plan_notes_are_demo_ready():
    known = set(specialties())
    booked_today = 0
    for patient_id in ("p1", "p2"):
        patient = load_patient(patient_id)
        notes = patient["care_plan_notes"]
        assert notes
        for note in notes:
            assert note["specialty"] in known
            assert followup.parse_interval(note["text"]) is not None
        booked_today += sum(
            1 for v in followup.plan_followups(patient, TODAY) if v["status"] == "booked"
        )
    assert booked_today >= 1


def test_module_and_data_stay_ascii():
    for name in ("followup.py", "mock_data/patients.json", "tests/test_followup.py"):
        text = (ROOT / name).read_text()
        assert text.isascii()


def test_two_notes_due_together_never_take_the_same_slot():
    patient = make_patient("aetna-001", [
        make_note("Recheck in 1 day.", specialty="Internal Medicine", note_id="n1"),
        make_note("Recheck in 1 day.", specialty="Internal Medicine", note_id="n2"),
    ])
    visits = followup.plan_followups(patient, TODAY)
    booked = [v for v in visits if v["status"] == "booked"]

    assert len(booked) == 2
    assert booked[0]["slot"] != booked[1]["slot"]
    assert len({(v["provider"]["provider_id"], v["slot"]) for v in booked}) == 2


def test_a_note_that_finds_every_slot_taken_is_unbookable_not_a_duplicate():
    notes = [
        make_note("Recheck in 1 day.", specialty="Internal Medicine", note_id=f"n{i}")
        for i in range(4)
    ]
    visits = followup.plan_followups(make_patient("aetna-001", notes), TODAY)
    booked = [v for v in visits if v["status"] == "booked"]
    left_over = [v for v in visits if v["status"] == "unbookable"]

    assert len(booked) == 3
    assert len({v["slot"] for v in booked}) == 3
    assert len(left_over) == 1
    assert left_over[0]["issue"] == followup.ISSUE_SLOTS_ALREADY_TAKEN
    assert left_over[0]["slot"] is None
    assert "already taken" in left_over[0]["issue_detail"]


def test_taken_slots_are_not_shared_between_separate_plans():
    patient = make_patient("aetna-001", [
        make_note("Recheck in 1 day.", specialty="Internal Medicine", note_id="n1"),
    ])

    first = followup.plan_followups(patient, TODAY)[0]
    second = followup.plan_followups(patient, TODAY)[0]

    assert first["slot"] == second["slot"]


@pytest.mark.parametrize("interval", [1000000000, True, False, 0, -5, 4000, "7", 3.5])
def test_hostile_interval_days_never_raises_and_never_guesses(interval):
    note = make_note("Patient doing well, continue current dose.")
    note["interval_days"] = interval
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "unparsed"
    assert visit["issue"] == "no_interval"
    assert visit["slot"] is None


def test_a_sane_explicit_interval_is_still_honoured():
    note = make_note("Patient doing well, continue current dose.", authored_on="2026-09-18")
    note["interval_days"] = 2
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["interval_days"] == 2
    assert visit["due_date"] == "2026-09-20"


def test_a_far_future_authored_date_does_not_overflow():
    note = make_note("Recheck in 2 weeks.", authored_on="9999-12-31")
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "unparsed"
    assert visit["issue"] == followup.ISSUE_NO_DUE_DATE
    assert visit["due_date"] is None
    assert followup.due_date(note, TODAY) is None


def test_non_string_note_text_is_coerced_not_crashed():
    note = make_note(12345)
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "unparsed"
    assert visit["issue"] == "no_interval"
    assert followup.parse_interval(12345) is None
    assert isinstance(visit["reason"], str)


@pytest.mark.parametrize("authored_on", [None, "", "not a date", "2026-02-30", 12345])
def test_a_note_without_a_usable_authored_date_is_reported_not_booked(authored_on):
    note = make_note("Recheck in 2 weeks.", authored_on=authored_on)
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "unparsed"
    assert visit["issue"] == followup.ISSUE_NO_AUTHORED_DATE
    assert visit["due_date"] is None
    assert visit["slot"] is None
    assert "authored date" in visit["issue_detail"]


def test_a_note_with_no_authored_on_key_at_all_is_reported():
    note = make_note("Recheck in 2 weeks.")
    del note["authored_on"]
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["issue"] == followup.ISSUE_NO_AUTHORED_DATE
    assert followup.due_date(note, TODAY) is None


def test_an_absurdly_stale_note_is_reported_rather_than_booked():
    note = make_note("Blood pressure review in 4 weeks.", authored_on="1900-01-01")
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "unparsed"
    assert visit["issue"] == followup.ISSUE_STALE_NOTE
    assert visit["slot"] is None
    assert "1900-01-01" in visit["issue_detail"]


def test_a_merely_overdue_note_is_not_treated_as_stale():
    note = make_note("Blood pressure review in 4 weeks.", authored_on="2026-01-05")
    visit = followup.plan_followups(make_patient("carefirst-001", [note]), TODAY)[0]

    assert visit["status"] == "booked"
    assert followup.note_is_stale(note, TODAY) is False


def test_spoken_reminder_never_speaks_a_dose_figure_for_any_mock_note():
    dose = re.compile(
        r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|ug|milligrams?|micrograms?)\b", re.IGNORECASE
    )
    checked = 0
    for patient_id in ("p1", "p2"):
        for visit in followup.plan_followups(load_patient(patient_id), TODAY):
            if visit["status"] != "booked":
                continue
            for kind in ("day_before", "same_day"):
                line = followup.spoken_reminder(visit, kind, visit["patient_first_name"])
                assert not dose.search(line), line
                assert followup.spoken_seconds(line) < followup.MAX_REMINDER_SECONDS
                checked += 1
    assert checked > 0


def test_spoken_reminder_drops_the_dosing_clause_but_keeps_the_purpose():
    visit = next(
        v for v in followup.plan_followups(load_patient("p2"), TODAY)
        if v["note_id"] == "cpn2"
    )
    line = followup.spoken_reminder(visit, "day_before", "Dorothy")

    assert "Blood pressure review in 4 weeks" in line
    assert "lisinopril" not in line.lower()
    assert "10mg" not in line
    assert "Dr. Raj Patel" in line
    assert followup.AUTOMATED_CALL_DISCLOSURE in line
    assert followup.NO_ADVICE_LINE in line


def test_spoken_reminder_drops_a_whole_dosing_sentence():
    visit = next(
        v for v in followup.plan_followups(load_patient("p1"), TODAY)
        if v["note_id"] == "cpn1"
    )
    line = followup.spoken_reminder(visit, "same_day", "Maria")

    assert "metformin" not in line.lower()
    assert "500" not in line
    assert "Recheck A1c in 3 months" in line
    assert "Dr. Elena Vance" in line


def test_a_note_that_is_only_a_dosing_clause_still_names_the_prescriber():
    visit = {
        "patient_first_name": "Sam",
        "provider_name": "Dr. Sarah Lin",
        "specialty": "Cardiology",
        "slot_local": "Monday, September 21 at 9:00 AM",
        "note_text": "Continue lisinopril 10mg once daily.",
        "prescriber": "Dr. Raj Patel",
    }
    line = followup.spoken_reminder(visit, "day_before")

    assert "10mg" not in line
    assert "Dr. Raj Patel" in line
    assert "Cardiology follow-up" in line
    assert followup.NO_ADVICE_LINE in line


@pytest.mark.parametrize("text,expected", [
    ("Blood pressure review in 4 weeks on lisinopril 10mg, with electrolytes.",
     "Blood pressure review in 4 weeks, with electrolytes."),
    ("Continue metformin 500mg twice daily. Recheck A1c in 3 months.",
     "Recheck A1c in 3 months."),
    ("Continue levothyroxine 50 mcg daily.", ""),
    ("Recheck BMP in 10 days.", "Recheck BMP in 10 days."),
    (None, ""),
])
def test_dose_safe_purpose_strips_only_the_dosing(text, expected):
    assert followup.dose_safe_purpose(text) == expected
