import hashlib
import hmac
from urllib.parse import parse_qs, urlparse

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

    def fake_place_call(to, **kw):
        placed.append(kw.get("status_callback"))
        return {"ok": True, "call_sid": "CAdialled", "status": "queued"}

    monkeypatch.setattr(telephony, "place_call", fake_place_call)
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: texted.append({"to": to, "body": body}) or {"ok": True, "sid": "SM1"},
    )
    return {"placed": placed, "texted": texted}


def gated(payload):
    body = dict(payload)
    expected = main.CALL_TOKEN or main.WEBHOOK_SECRET
    if expected:
        body["secret"] = expected
    return body


def dial(client, session):
    return client.post(
        "/call/start", json=gated({"patient_id": "p1"}),
        headers={"X-CareLoop-Session": session},
    )


def status_path(url):
    parsed = urlparse(url)
    return parsed.path + "?" + parsed.query


def test_a_captured_status_callback_only_texts_once(configured, wires):
    client = TestClient(main.app)
    session = "replay-once"
    dial(client, session)
    url = status_path(wires["placed"][0])

    for _ in range(4):
        response = client.post(
            url,
            data={"CallStatus": "no-answer", "CallSid": "CAnever"},
            headers={"X-CareLoop-Session": session},
        )
        assert response.status_code == 204, "a replay must never be a 4xx to Twilio"

    assert len(wires["texted"]) == 1


def test_the_repo_fallback_secret_cannot_sign_a_callback(configured, wires, monkeypatch):
    monkeypatch.setattr(main, "CALL_TOKEN", "")
    monkeypatch.setattr(main, "WEBHOOK_SECRET", "")
    client = TestClient(main.app)

    basis = "p1|forge-me|1".encode("utf-8")
    forged = hmac.new(b"careloop-unsigned", basis, hashlib.sha256).hexdigest()[:32]
    response = client.post(
        f"/voice/checkin/status?patient_id=p1&attempt=1&sig={forged}",
        data={"CallStatus": "no-answer", "CallSid": "CA1"},
        headers={"X-CareLoop-Session": "forge-me"},
    )
    assert response.status_code == 403
    assert wires["texted"] == []


def test_the_text_never_runs_past_two_segments(configured, wires):
    client = TestClient(main.app)
    session = "replay-long"
    client.post(
        "/meds",
        json={"patient_id": "p1", "medication": "Warfarin " + "x" * 600,
              "dosage_text": "y" * 200, "preferred_hours": [8]},
        headers={"X-CareLoop-Session": session},
    )
    dial(client, session)
    client.post(
        status_path(wires["placed"][0]),
        data={"CallStatus": "no-answer", "CallSid": "CAlong"},
        headers={"X-CareLoop-Session": session},
    )
    assert len(wires["texted"]) == 1
    assert len(wires["texted"][0]["body"]) <= 320


def test_the_text_path_is_metered_like_a_call(configured, wires):
    client = TestClient(main.app)
    session = "replay-flood"
    for i in range(12):
        dial(client, session)
        if not wires["placed"]:
            continue
        client.post(
            status_path(wires["placed"][-1]),
            data={"CallStatus": "no-answer", "CallSid": f"CA{i}"},
            headers={"X-CareLoop-Session": session},
        )
    assert len(wires["texted"]) <= telephony.PER_MINUTE_LIMIT


def test_an_impossible_dose_hour_is_refused_not_a_500():
    client = TestClient(main.app)
    response = client.post(
        "/meds",
        json={"patient_id": "p1", "medication": "Aspirin", "preferred_hours": [99]},
        headers={"X-CareLoop-Session": "replay-hours"},
    )
    assert response.status_code == 400
    assert client.get(
        "/schedule/p1", headers={"X-CareLoop-Session": "replay-hours"},
    ).status_code == 200
