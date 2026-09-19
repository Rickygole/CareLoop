import pytest
from fastapi.testclient import TestClient

import main
import telephony


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC" + "0" * 32)
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "x" * 32)
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15550001111")
    monkeypatch.setenv("DEMO_PHONE_NUMBER", "+15550002222")


@pytest.fixture
def dialled(monkeypatch):
    placed = []

    def fake_place_call(to, twiml_url=None, twiml=None, status_callback=None, **kw):
        placed.append({"to": to, "status_callback": status_callback})
        return {"ok": True, "call_sid": "CAretry", "status": "queued"}

    monkeypatch.setattr(telephony, "place_call", fake_place_call)
    return placed


def report(client, session, attempt, status, duration, answered_by=None, call_sid=None, sign=True):
    body = {"CallStatus": status, "CallDuration": str(duration)}
    if answered_by:
        body["AnsweredBy"] = answered_by
    if call_sid:
        body["CallSid"] = call_sid
    query = f"/voice/checkin/status?patient_id=p1&attempt={attempt}"
    if sign:
        query += "&sig=" + main._callback_signature("p1", session, attempt)
    return client.post(query, data=body, headers={"X-CareLoop-Session": session})


def engage(client, session, call_sid):
    client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "i took it, feeling fine", "CallSid": call_sid},
        headers={"X-CareLoop-Session": session},
    )


def next_attempt(placed):
    url = placed[-1]["status_callback"]
    return int(url.split("attempt=")[1].split("&")[0])


def test_an_unanswered_call_is_placed_again(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-unanswered", 1, "no-answer", 0)
    assert len(dialled) == 1
    assert dialled[0]["to"] == "+15550002222"
    assert next_attempt(dialled) == 2


def test_a_call_the_patient_drops_early_is_placed_again(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-dropped", 1, "completed", 4)
    assert len(dialled) == 1
    assert next_attempt(dialled) == 2


def test_a_call_the_patient_answered_is_not_placed_again(configured, dialled):
    client = TestClient(main.app)
    engage(client, "retry-answered", "CAanswered")
    report(client, "retry-answered", 1, "completed", 40, call_sid="CAanswered")
    assert dialled == []


def test_voicemail_that_played_the_whole_script_is_still_placed_again(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-voicemail", 1, "completed", 60, call_sid="CAvoicemail")
    assert len(dialled) == 1


def test_a_listener_who_hangs_up_before_answering_is_placed_again(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-listener", 1, "completed", 25, call_sid="CAlistener")
    assert len(dialled) == 1


def test_an_unsigned_callback_places_no_call(configured, dialled):
    client = TestClient(main.app)
    for _ in range(25):
        r = report(client, "retry-unsigned", 1, "no-answer", 0, sign=False)
        assert r.status_code == 403
    assert dialled == []


def test_a_callback_signed_for_another_session_places_no_call(configured, dialled):
    client = TestClient(main.app)
    sig = main._callback_signature("p1", "some-other-session", 1)
    r = client.post(
        f"/voice/checkin/status?patient_id=p1&attempt=1&sig={sig}",
        data={"CallStatus": "no-answer"},
        headers={"X-CareLoop-Session": "retry-wrong-session"},
    )
    assert r.status_code == 403
    assert dialled == []


def test_a_negative_attempt_cannot_extend_the_cap(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-negative", -9999, "no-answer", 0)
    assert len(dialled) == 1
    assert next_attempt(dialled) == 2


def test_the_redial_stops_at_the_attempt_cap(configured, dialled):
    client = TestClient(main.app)
    report(client, "retry-cap", main.MAX_CALL_ATTEMPTS, "no-answer", 0)
    assert dialled == []


def test_every_redial_reaches_only_the_demo_number(configured, dialled):
    client = TestClient(main.app)
    for attempt in range(1, main.MAX_CALL_ATTEMPTS):
        report(client, f"retry-number-{attempt}", attempt, "busy", 0)
    assert dialled
    assert {call["to"] for call in dialled} == {"+15550002222"}
