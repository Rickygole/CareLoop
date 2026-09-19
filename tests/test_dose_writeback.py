import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def headers(name):
    return {"X-CareLoop-Session": name}


def taken(session, patient_id="p1"):
    body = client.get(f"/regimen/{patient_id}", headers=headers(session)).json()
    return body["schedule"]["doses_taken"]


def by_phone(session, said):
    return client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": said, "CallSid": "CA" + session},
        headers=headers(session),
    )


def in_writing(session, said):
    return client.post(
        "/loop/run", json={"patient_id": "p1", "transcript": said}, headers=headers(session)
    )


@pytest.mark.parametrize("channel", [by_phone, in_writing])
def test_saying_you_took_it_updates_the_record(channel):
    session = f"writeback-{channel.__name__}"
    before = taken(session)
    channel(session, "yes I took it just now")
    assert taken(session) == before + 1, (
        "CareLoop said it had made a note on the record and the record did not "
        "change. A judge who asks to see the dose they just confirmed finds "
        "nothing."
    )


@pytest.mark.parametrize("said", [
    "no I forgot to take it",
    "I have not taken it yet",
    "I skipped it this morning",
    "I did not take it",
])
def test_saying_you_did_not_take_it_records_nothing(said):
    session = "writeback-negative-" + said[:6].replace(" ", "")
    before = taken(session)
    in_writing(session, said)
    assert taken(session) == before, f"{said!r} was recorded as a dose taken"


def test_an_emergency_answer_does_not_quietly_mark_a_dose_taken():
    session = "writeback-emergency"
    before = taken(session)
    by_phone(session, "my chest is crushing and my arm is numb")
    assert taken(session) == before


def test_the_confirmation_is_announced_on_the_trace():
    session = "writeback-trace"
    in_writing(session, "yes I took it")
    token = f"&token={main.WEBHOOK_SECRET}" if main.WEBHOOK_SECRET else ""
    events = client.get(
        f"/trace/events?since=0{token}", headers=headers(session)
    ).json()["events"]
    assert "DOSE_CONFIRMED" in [e["event_type"] for e in events]


def test_one_visitors_dose_never_shows_on_another_visitors_record():
    in_writing("writeback-mine", "yes I took it")
    assert taken("writeback-mine") > taken("writeback-theirs")
