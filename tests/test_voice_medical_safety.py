import re

import pytest
from fastapi.testclient import TestClient

import main


def trace_url(since=0):
    base = f"/trace/events?since={since}"
    return base + (f"&token={main.WEBHOOK_SECRET}" if main.WEBHOOK_SECRET else "")


client = TestClient(main.app)

INSTRUCTIONS = ["please take it", "take it now", "you should take", "go ahead and take"]
REMINDER = "this is a reminder to take your"


def headers(name):
    return {"X-CareLoop-Session": name}


def said(xml):
    return " ".join(re.findall(r"<Say[^>]*>(.*?)</Say>", xml)).lower()


def greeting(patient_id, session):
    return said(
        client.get(f"/voice/checkin?patient_id={patient_id}", headers=headers(session)).text
    )


def flag_the_next_dose(session_name):
    session_headers = headers(session_name)
    client.post("/portal/sync", json={"patient_id": "p2"}, headers=session_headers)
    client.post(
        "/portal/sync",
        json={"patient_id": "p2", "accept_portal_changes": True},
        headers=session_headers,
    )
    patient = main.SESSIONS.get(session_name).patients["p2"]
    patient["medication_requests"] = [
        m for m in patient["medication_requests"]
        if m["medication"].lower() in {"spironolactone", "lisinopril"}
    ]
    return patient


def test_the_check_in_reminds_the_patient_to_take_an_unflagged_medicine():
    spoken = greeting("p2", "med-safety-p2")
    assert REMINDER in spoken, "p2 carries no flagged pair and must be reminded"


def test_the_check_in_withholds_the_reminder_for_a_flagged_medicine():
    spoken = greeting("p1", "med-safety-p1")
    assert REMINDER not in spoken, (
        "p1 carries a major warfarin and aspirin pair, so the reminder must be withheld"
    )
    assert "i am not going to ask you to take it" in spoken


@pytest.mark.parametrize("patient_id", ["p1", "p2"])
def test_the_check_in_still_asks_how_they_have_been_feeling(patient_id):
    spoken = greeting(patient_id, f"med-asks-{patient_id}")
    assert "how you have been feeling" in spoken


def test_a_flagged_medicine_is_detected_as_flagged():
    patient = flag_the_next_dose("med-flag-detect")
    assert main._next_dose_is_flagged(patient) == ["lisinopril", "spironolactone"]


def test_a_flagged_medicine_is_not_prompted_for():
    flag_the_next_dose("med-flag-prompt")
    spoken = greeting("p2", "med-flag-prompt")
    assert "i am not going to ask you to take it" in spoken
    assert REMINDER not in spoken
    for phrase in INSTRUCTIONS:
        assert phrase not in spoken


def test_a_flagged_medicine_sends_the_patient_to_a_human():
    flag_the_next_dose("med-flag-human")
    spoken = greeting("p2", "med-flag-human")
    assert "prescriber or pharmacist" in spoken
    assert "do not start, stop or change" in spoken


def test_withholding_the_prompt_is_recorded_on_the_trace():
    session = "med-flag-trace"
    flag_the_next_dose(session)
    greeting("p2", session)
    types = [
        e["event_type"]
        for e in client.get(trace_url(0), headers=headers(session)).json()["events"]
    ]
    assert "DOSE_PROMPT_WITHHELD" in types


def test_an_unflagged_regimen_is_reminded_normally():
    spoken = greeting("p2", "med-unflagged")
    assert "i am not going to ask you to take it" not in spoken
    assert REMINDER in spoken


@pytest.mark.parametrize("path", ["/voice/checkin?patient_id=ghost"])
def test_an_unknown_patient_never_has_another_record_read_aloud(path):
    r = client.get(path, headers=headers("med-unknown"))
    assert r.status_code == 404
    assert "maria" not in r.text.lower()


def test_an_unknown_patient_is_rejected_on_the_respond_leg():
    r = client.post(
        "/voice/checkin/respond?patient_id=ghost",
        data={"SpeechResult": "i took it"},
        headers=headers("med-unknown-respond"),
    )
    assert r.status_code == 404
