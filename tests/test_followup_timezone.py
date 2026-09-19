import json
import subprocess
import sys
from datetime import date, datetime, timezone

import pytest

import followup

HOST_ZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Auckland"]

PROBE = """
import json, followup
notes = [
    n
    for p in json.load(open("mock_data/patients.json"))["patients"]
    for n in p.get("care_plan_notes", [])
]
print(json.dumps({n["note_id"]: str(followup.due_date(n, "2026-09-19")) for n in notes}))
"""


def due_dates_under(zone):
    result = subprocess.run(
        [sys.executable, "-c", PROBE],
        capture_output=True,
        text=True,
        env={"TZ": zone, "PATH": "/usr/bin:/bin"},
        check=True,
    )
    return json.loads(result.stdout)


def test_due_dates_do_not_depend_on_the_host_timezone():
    results = {zone: due_dates_under(zone) for zone in HOST_ZONES}
    baseline = results[HOST_ZONES[0]]
    for zone, found in results.items():
        assert found == baseline, f"{zone} disagreed with {HOST_ZONES[0]}: {found} != {baseline}"


def test_a_calendar_date_is_never_shifted_by_a_timezone():
    assert followup._as_date("2026-08-24") == date(2026, 8, 24)
    assert followup._as_date("2026-01-01") == date(2026, 1, 1)
    assert followup._as_date("2026-12-31") == date(2026, 12, 31)


def test_a_naive_timestamp_is_read_as_clinic_time():
    assert followup._as_date("2026-08-24T23:30:00") == date(2026, 8, 24)
    assert followup._as_date(datetime(2026, 8, 24, 23, 30)) == date(2026, 8, 24)


def test_an_aware_timestamp_is_converted_to_clinic_time():
    assert followup._as_date("2026-08-25T02:00:00Z") == date(2026, 8, 24)


def test_a_visit_is_never_booked_before_the_note_is_due():
    patients = {
        p["patient_id"]: p for p in json.load(open("mock_data/patients.json"))["patients"]
    }
    now = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
    for patient in patients.values():
        for visit in followup.plan_followups(patient, today=now.date()):
            if visit["status"] != followup.STATUS_BOOKED:
                continue
            due = date.fromisoformat(visit["due_date"])
            booked = followup._parse_slot(visit["slot"]).date()
            assert booked >= due, (
                f"{visit['note_id']} booked {booked} before it was due {due}"
            )


@pytest.mark.parametrize("bad", ["", "not a date", None, "2026-13-45"])
def test_unparseable_dates_return_none_rather_than_guessing(bad):
    assert followup._as_date(bad) is None
