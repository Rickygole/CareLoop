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
def wires(monkeypatch):
    placed, texted = [], []

    monkeypatch.setattr(
        telephony, "place_call",
        lambda to, **kw: placed.append(to) or {"ok": True, "call_sid": "CAretry", "status": "queued"},
    )
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: texted.append({"to": to, "body": body}) or {"ok": True, "sid": "SM1"},
    )
    return {"placed": placed, "texted": texted}


def report(client, session, status, call_sid, attempt=1, sign=True):
    nonce = main._issue_callback_nonce(main.SESSIONS.get(session), attempt)
    query = f"/voice/checkin/status?patient_id=p1&attempt={attempt}&nonce={nonce}"
    if sign:
        query += "&sig=" + main._callback_signature("p1", session, attempt, nonce)
    return client.post(
        query,
        data={"CallStatus": status, "CallDuration": "4", "CallSid": call_sid},
        headers={"X-CareLoop-Session": session},
    )


def engage(client, session, call_sid):
    client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "i took it, feeling fine", "CallSid": call_sid},
        headers={"X-CareLoop-Session": session},
    )


@pytest.mark.parametrize("status", ["busy", "no-answer", "failed", "canceled"])
def test_a_call_the_patient_does_not_take_is_answered_with_a_text(configured, wires, status):
    client = TestClient(main.app)
    report(client, f"retry-{status}", status, "CA1")
    assert len(wires["texted"]) == 1
    assert wires["placed"] == [], "declining must never trigger another call"


def test_the_text_reminds_them_of_the_medicine_by_name(configured, wires):
    client = TestClient(main.app)
    report(client, "retry-body", "busy", "CA1")
    body = wires["texted"][0]["body"]
    assert "reminder to take your" in body
    assert "Maria" in body
    assert "911" in body
    assert "not medical advice" in body


def test_the_text_only_ever_reaches_the_demo_number(configured, wires):
    client = TestClient(main.app)
    report(client, "retry-number", "no-answer", "CA1")
    assert [t["to"] for t in wires["texted"]] == ["+15550002222"]


def test_a_call_the_patient_answered_is_not_followed_by_a_text(configured, wires):
    client = TestClient(main.app)
    session = "retry-answered"
    engage(client, session, "CAanswered")
    report(client, session, "completed", "CAanswered")
    assert wires["texted"] == []
    assert wires["placed"] == []


def test_voicemail_that_played_the_whole_script_still_gets_the_text(configured, wires):
    client = TestClient(main.app)
    report(client, "retry-voicemail", "completed", "CAvoicemail")
    assert len(wires["texted"]) == 1


def test_a_listener_who_hangs_up_before_answering_gets_the_text(configured, wires):
    client = TestClient(main.app)
    report(client, "retry-listener", "completed", "CAlistener")
    assert len(wires["texted"]) == 1


def test_an_unsigned_callback_sends_nothing_at_all(configured, wires):
    client = TestClient(main.app)
    for _ in range(25):
        assert report(client, "retry-unsigned", "no-answer", "CA1", sign=False).status_code == 403
    assert wires["texted"] == []
    assert wires["placed"] == []


def test_a_callback_signed_for_another_session_sends_nothing(configured, wires):
    client = TestClient(main.app)
    nonce = main._issue_callback_nonce(main.SESSIONS.get("retry-wrong-session"), 1)
    sig = main._callback_signature("p1", "some-other-session", 1, nonce)
    r = client.post(
        f"/voice/checkin/status?patient_id=p1&attempt=1&nonce={nonce}&sig={sig}",
        data={"CallStatus": "no-answer"},
        headers={"X-CareLoop-Session": "retry-wrong-session"},
    )
    assert r.status_code == 403
    assert wires["texted"] == []


def test_a_flagged_medicine_is_not_pushed_by_text_either(configured, wires, monkeypatch):
    client = TestClient(main.app)
    session = "retry-flagged"
    monkeypatch.setattr(main, "_next_dose_is_flagged", lambda p: ["lisinopril", "spironolactone"])
    report(client, session, "busy", "CA1")
    body = wires["texted"][0]["body"]
    assert "reminder to take your" not in body
    assert "prescriber or pharmacist" in body
    assert "do not start, stop or change" in body
