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
    monkeypatch.setattr(
        telephony, "place_call",
        lambda to, **kw: {"ok": True, "call_sid": "CAstate", "status": "queued"},
    )


def gated(payload):
    body = dict(payload)
    expected = main.CALL_TOKEN or main.WEBHOOK_SECRET
    if expected:
        body["secret"] = expected
    return body


def state(client, session):
    return client.get("/call/state", headers={"X-CareLoop-Session": session}).json()


def ring(client, session):
    return client.post(
        "/call/start", json=gated({"patient_id": "p1"}),
        headers={"X-CareLoop-Session": session},
    )


def report(client, session, attempt, status, call_sid):
    sig = main._callback_signature("p1", session, attempt)
    return client.post(
        f"/voice/checkin/status?patient_id=p1&attempt={attempt}&sig={sig}",
        data={"CallStatus": status, "CallDuration": "4", "CallSid": call_sid},
        headers={"X-CareLoop-Session": session},
    )


def test_before_any_call_the_state_is_idle():
    client = TestClient(main.app)
    assert state(client, "cs-idle")["phase"] == "idle"


def test_placing_a_call_reports_ringing(configured):
    client = TestClient(main.app)
    session = "cs-ringing"
    ring(client, session)
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_RINGING
    assert found["retrying"] is False
    assert "ringing" in found["wording"].lower()


def test_cutting_the_call_reports_that_it_is_ringing_you_back(configured):
    client = TestClient(main.app)
    session = "cs-redial"
    ring(client, session)
    report(client, session, 1, "completed", "CA1")
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_REDIALLING
    assert found["retrying"] is True
    assert found["attempt"] == 2
    assert "ringing you again" in found["wording"]


def test_the_attempt_counter_is_visible_and_bounded(configured):
    client = TestClient(main.app)
    session = "cs-counter"
    ring(client, session)
    for attempt in (1, 2):
        report(client, session, attempt, "no-answer", f"CA{attempt}")
    found = state(client, session)
    assert found["attempt"] == 3
    assert found["max_attempts"] == main.MAX_CALL_ATTEMPTS


def test_answering_the_call_stops_the_retrying_state(configured):
    client = TestClient(main.app)
    session = "cs-answered"
    ring(client, session)
    report(client, session, 1, "completed", "CA1")
    client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "i took it", "CallSid": "CA2"},
        headers={"X-CareLoop-Session": session},
    )
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_ANSWERED
    assert found["retrying"] is False


def test_after_the_last_attempt_it_says_it_stopped(configured):
    client = TestClient(main.app)
    session = "cs-gaveup"
    ring(client, session)
    report(client, session, main.MAX_CALL_ATTEMPTS, "no-answer", "CAlast")
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_GAVE_UP
    assert found["retrying"] is False
    assert "stopped calling" in found["wording"]


def test_one_visitor_never_sees_another_visitors_call(configured):
    client = TestClient(main.app)
    ring(client, "cs-mine")
    assert state(client, "cs-theirs")["phase"] == "idle"
