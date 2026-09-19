import escalation
import telephony
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

CRISIS = "I have been thinking about ending my life"
EMERGENCY = "I have crushing chest pain and my left arm is numb"
SEVERE = "I coughed up blood twice today and I feel faint"
MODERATE = "I have been dizzy for two days and my ankles are swollen"


def headers(name):
    return {"X-CareLoop-Session": name}


def run(session, transcript, patient_id="p1"):
    return client.post(
        "/loop/run",
        json={"patient_id": patient_id, "transcript": transcript},
        headers=headers(session),
    ).json()


def escalations(session, patient_id="p1"):
    return client.get(f"/escalations/{patient_id}", headers=headers(session)).json()


def test_assigned_provider_reads_the_patients_own_prescriber():
    import json
    patients = json.load(open("mock_data/patients.json"))
    p1 = next(p for p in patients["patients"] if p["patient_id"] == "p1")
    provider = escalation.assigned_provider(p1)
    assert provider["name"] in {"Dr. Elena Vance", "Dr. Ana Reyes"}


def test_no_alert_phone_configured_records_that_and_sends_nothing(monkeypatch):
    monkeypatch.delenv(escalation.ALERT_PHONE_ENV, raising=False)
    sent = []
    monkeypatch.setattr(telephony, "send_sms", lambda to, body: sent.append((to, body)) or {"ok": True})
    result = run("alert-unconfigured", EMERGENCY)
    assert not sent, "an SMS was sent with no alert phone configured"
    record = result["escalation"]
    assert record["notification_transport"] == "no_alert_phone_configured"
    assert record["notification_delivered"] is False


def test_an_emergency_sends_an_sms_to_the_configured_number(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True, "sid": "SMxyz"},
    )
    result = run("alert-emergency", EMERGENCY)
    assert sent, "no SMS was sent for a Tier 0 emergency"
    to, body = sent[0]
    assert to == "+15550001111"
    assert "EMERGENCY" in body
    assert result["escalation"]["notification_delivered"] is True
    assert result["escalation"]["alert_sms"]["sid"] == "SMxyz"


def test_a_crisis_also_sends_an_sms(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True, "sid": "SMabc"},
    )
    result = run("alert-crisis", CRISIS)
    assert sent, "no SMS was sent for a crisis disclosure"
    assert "CRISIS" in sent[0][1]


def test_a_severe_tier_classification_also_sends_an_sms(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True, "sid": "SMdef"},
    )
    result = run("alert-severe", SEVERE)
    if result["escalation"] and result["escalation"]["kind"] == "severe":
        assert sent, "a severe Tier 1 classification did not alert the provider"


def test_a_moderate_case_does_not_page_anyone(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True},
    )
    result = run("alert-moderate", MODERATE)
    if result["escalation"] and result["escalation"]["kind"] == "moderate":
        assert not sent, "a moderate finding paged the provider, which is over-alerting"


def test_the_sms_names_the_patient_and_quotes_what_they_said(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True},
    )
    run("alert-content", EMERGENCY)
    assert sent
    body = sent[0][1]
    assert "Maria Santos" in body
    assert "chest pain" in body


def test_an_sms_delivery_failure_does_not_break_the_response(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: {"ok": False, "error": "http_500"},
    )
    result = run("alert-failure", EMERGENCY)
    assert result["escalation"]["notification_delivered"] is False
    assert result["triage"]["is_emergency"] is True


def test_the_escalation_history_endpoint_shows_the_alert_outcome(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: {"ok": True, "sid": "SMhist"},
    )
    session = "alert-history"
    run(session, EMERGENCY)
    body = escalations(session)
    assert body["escalations"], "the escalation never made it into the history list"
    last = body["escalations"][-1]
    assert last["alert_sms"]["sid"] == "SMhist"


def test_the_live_trace_carries_a_readable_headline(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: {"ok": True, "sid": "SMline"},
    )
    session = "alert-trace"
    result = run(session, EMERGENCY)
    events = [e for e in result["events"] if e["event_type"] == "ESCALATION_FIRED"]
    assert events, "no ESCALATION_FIRED event was put on the trace feed"
    assert "notified" in events[-1]["payload"]["headline"].lower()


def test_voice_path_emergency_also_alerts(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550001111")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True},
    )
    client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": EMERGENCY, "CallSid": "CAvoicealert"},
        headers=headers("alert-voice"),
    )
    assert sent, "the phone call path never alerted the assigned provider on an emergency"
