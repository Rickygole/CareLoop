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
    nonce = main._issue_callback_nonce(main.SESSIONS.get(session), attempt)
    sig = main._callback_signature("p1", session, attempt, nonce)
    return client.post(
        f"/voice/checkin/status?patient_id=p1&attempt={attempt}&nonce={nonce}&sig={sig}",
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


def test_cutting_the_call_reports_that_a_text_was_sent(configured, monkeypatch):
    monkeypatch.setattr(telephony, "send_sms", lambda to, body: {"ok": True, "sid": "SM1"})
    client = TestClient(main.app)
    session = "cs-texted"
    ring(client, session)
    report(client, session, 1, "completed", "CA1")
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_TEXTED
    assert found["retrying"] is False
    assert "sent you a text" in found["wording"]


def test_declining_the_call_sends_one_text_and_never_redials(configured, monkeypatch):
    texts = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: texts.append((to, body)) or {"ok": True, "sid": "SM1"},
    )
    dials = []
    monkeypatch.setattr(
        telephony, "place_call",
        lambda to, **kw: dials.append(to) or {"ok": True, "call_sid": "CA1", "status": "queued"},
    )
    client = TestClient(main.app)
    session = "cs-decline"
    ring(client, session)
    before = len(dials)
    report(client, session, 1, "busy", "CA1")

    assert len(texts) == 1, "declining must send exactly one text"
    assert len(dials) == before, "declining must not place another call"
    assert texts[0][0] == "+15550002222"
    assert "reminder to take your" in texts[0][1]
    assert state(client, session)["phase"] == main.CALL_PHASE_TEXTED


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


def test_a_text_that_fails_to_send_is_reported_not_hidden(configured, monkeypatch):
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: {"ok": False, "sid": None, "error": "http_400"},
    )
    client = TestClient(main.app)
    session = "cs-textfail"
    ring(client, session)
    report(client, session, 1, "no-answer", "CAfail")
    found = state(client, session)
    assert found["phase"] == main.CALL_PHASE_GAVE_UP
    assert "did not send" in found["wording"]


def test_one_visitor_never_sees_another_visitors_call(configured):
    client = TestClient(main.app)
    ring(client, "cs-mine")
    assert state(client, "cs-theirs")["phase"] == "idle"
