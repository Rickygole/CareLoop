import pytest
from fastapi.testclient import TestClient

import main


@pytest.fixture
def flagged(monkeypatch):
    monkeypatch.setattr(
        main, "_next_dose_is_flagged", lambda p: ["lisinopril", "spironolactone"],
    )


def test_a_flagged_dose_is_not_pushed_when_nobody_speaks(flagged):
    client = TestClient(main.app)
    body = client.get(
        "/voice/checkin?patient_id=p1", headers={"X-CareLoop-Session": "tail-gather"},
    ).text
    assert "not going to ask you to take it" in body
    assert "remember to take your" not in body.lower()


def test_a_flagged_dose_is_not_pushed_on_an_empty_speech_result(flagged):
    client = TestClient(main.app)
    body = client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "", "CallSid": "CAsilent"},
        headers={"X-CareLoop-Session": "tail-empty"},
    ).text
    assert "remember to take your" not in body.lower()
    assert "prescriber or pharmacist" in body


def test_a_crisis_still_holds_the_line_when_triage_blows_up(monkeypatch):
    async def exploding(*a, **kw):
        raise RuntimeError("triage backend is down")

    monkeypatch.setattr(main, "run_triage", exploding)
    client = TestClient(main.app)
    response = client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "i want to kill myself", "CallSid": "CAcrisis"},
        headers={"X-CareLoop-Session": "tail-crisis"},
    )
    assert response.status_code == 200
    assert "<Hangup/>" not in response.text
    assert "988" in response.text


def test_a_routine_answer_still_gets_twiml_when_triage_blows_up(monkeypatch):
    async def exploding(*a, **kw):
        raise RuntimeError("triage backend is down")

    monkeypatch.setattr(main, "run_triage", exploding)
    client = TestClient(main.app)
    response = client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": "i took it, feeling fine", "CallSid": "CAok"},
        headers={"X-CareLoop-Session": "tail-ok"},
    )
    assert response.status_code == 200
    assert "<Say" in response.text
