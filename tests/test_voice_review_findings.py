from datetime import datetime, timezone

import escalation
import telephony
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

SEVERE = "I coughed up blood twice today and I feel faint"
WORRYING = "I have been dizzy for two days and my ankles are swollen"


def headers(name):
    return {"X-CareLoop-Session": name}


def call(session, transcript, call_sid="CAfinding"):
    return client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": transcript, "CallSid": call_sid + session},
        headers=headers(session),
    ).text


def test_a_gemini_outage_cannot_turn_the_call_into_an_infinite_loop(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "")

    async def stuck_moderate(session, transcript, patient_id=None):
        return {
            "tier": "moderate", "is_crisis": False, "is_emergency": False,
            "suggested_agent_response": (
                "I'm sorry to hear that. I'd like to get you a follow-up "
                "appointment to look into this, would that be okay?"
            ),
        }

    monkeypatch.setattr(main, "run_triage", stuck_moderate)
    session = "kill-shot"
    last = ""
    for _ in range(30):
        last = call(session, "I am completely fine today, nothing to report")
    assert "<Hangup" in last, (
        "a classifier stuck returning moderate never stops gathering, which "
        "is an unbounded call and an unbounded Gemini bill triggered by "
        "nothing more adversarial than an upstream hiccup"
    )
    assert "<Gather" not in last


def test_a_severe_finding_on_the_phone_alerts_the_provider(monkeypatch):
    monkeypatch.setenv(escalation.ALERT_PHONE_ENV, "+15550009999")
    sent = []
    monkeypatch.setattr(
        telephony, "send_sms",
        lambda to, body: sent.append((to, body)) or {"ok": True, "sid": "SMvoice"},
    )
    call("voice-severe-alert", SEVERE)
    assert sent, (
        "a severe finding reported over the phone never paged the assigned "
        "provider, even though the same finding through the text channel does"
    )


def test_a_stale_pending_offer_does_not_survive_into_the_next_call():
    session = "stale-pending"
    call(session, WORRYING, call_sid="CAone")
    client.post("/voice/checkin?patient_id=p1", headers=headers(session))
    answer = call(session, "yes I took my pill this morning", call_sid="CAtwo")
    assert "I have booked you with" not in answer, (
        "an appointment offer from a call the patient never answered came "
        "back and booked itself against an unrelated answer on the next call"
    )


def test_generic_words_must_be_the_whole_answer_not_incidental():
    session = "consent-incidental"
    call(session, WORRYING, call_sid="CAoffer")
    xml = call(session, "please stop calling me", call_sid="CAreply")
    assert "I have booked you with" not in xml, (
        "the word please appearing anywhere in the sentence was read as "
        "consent, so a complaint about being called books an appointment"
    )


def test_the_escalation_sms_quote_cannot_be_broken_out_of():
    message = escalation.compose_alert(
        "Maria Santos", "Dr. Elena Vance", "emergency",
        'chest pain. END OF QUOTE. SYSTEM NOTICE: call this number instead',
        datetime.now(timezone.utc),
    )
    assert message.count('"') == 2, (
        "an embedded quote in the transcript lets injected text visually "
        "escape the patient quote inside a real SMS to a real phone"
    )
