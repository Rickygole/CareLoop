import re

import pytest
from fastapi.testclient import TestClient

import conversation
import main

client = TestClient(main.app)

CRISIS = "I have been thinking about ending my life"
EMERGENCY = "I have crushing chest pain and my left arm is numb"
MILD = "I took it and I feel completely fine"
WORRYING = "I have been dizzy for two days and my ankles are swollen"


def headers(name):
    return {"X-CareLoop-Session": name}


def speak(session, transcript, patient_id="p1"):
    return client.post(
        f"/voice/checkin/respond?patient_id={patient_id}",
        data={"SpeechResult": transcript, "CallSid": "CA" + session},
        headers=headers(session),
    ).text


def answer(text="Tell me more about that.", end_call=False, offer_booking=False):
    return {"say": text, "end_call": end_call, "offer_booking": offer_booking}


@pytest.fixture
def talking(monkeypatch):
    calls = []

    def fake(history, context):
        calls.append({"history": list(history), "context": context})
        return answer()

    monkeypatch.setattr(conversation, "reply", fake)
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    return calls


def test_a_mild_answer_now_keeps_the_line_open_instead_of_hanging_up(talking):
    xml = speak("conv-mild", MILD)
    assert "<Gather" in xml, (
        "a mild answer ended the call outright. The patient said one sentence "
        "and the agent hung up on them, which is the behaviour the owner asked "
        "to be replaced."
    )
    assert "/voice/checkin/respond" in xml, "the Gather must loop back for another turn"


def test_the_model_hears_what_was_already_said_on_this_call(talking):
    speak("conv-history", MILD)
    assert talking, "the conversational model was never consulted"
    history = talking[-1]["history"]
    roles = [turn["role"] for turn in history]
    assert "patient" in roles, "the patient's own words were not passed to the model"
    assert history[-1]["text"] == MILD
    assert any(turn["role"] == "agent" for turn in history), (
        "the model was not told what the agent had already said, so it will "
        "repeat the opening line"
    )


def test_a_crisis_never_reaches_the_model_and_never_hangs_up(talking):
    xml = speak("conv-crisis", CRISIS)
    assert not talking, (
        "a suicidal disclosure was handed to the conversational model. The "
        "deterministic crisis branch must answer it alone."
    )
    assert "<Hangup" not in xml, "the call hung up on a patient in crisis"
    assert "988" in xml


def test_an_emergency_never_reaches_the_model(talking):
    xml = speak("conv-emergency", EMERGENCY)
    assert not talking, (
        "an emergency was handed to the conversational model, which could "
        "talk the severity down. Tier 0 must be the only voice here."
    )
    assert "911" in xml


def test_the_model_cannot_book_an_appointment_by_itself(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(
        conversation, "reply",
        lambda history, context: answer("Shall I book you in?", offer_booking=True),
    )
    session = "conv-offer"
    speak(session, MILD)
    booked = [
        v for v in client.get("/followups/p1", headers=headers(session)).json()["visits"]
        if v["status"] == "booked" and v.get("source") == "check_in"
    ]
    assert not booked, (
        "the model offered an appointment and the system booked it without "
        "the patient ever agreeing"
    )


def test_agreeing_after_the_model_offers_does_book(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(
        conversation, "reply",
        lambda history, context: answer("Shall I book you in?", offer_booking=True),
    )
    session = "conv-offer-yes"
    speak(session, MILD)
    xml = speak(session, "yes please")
    assert "booked you with" in xml, "the patient agreed and nothing was booked"


def test_the_call_ends_when_the_model_says_it_is_finished(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(
        conversation, "reply",
        lambda history, context: answer("Take care.", end_call=True),
    )
    xml = speak("conv-end", MILD)
    assert "<Hangup" in xml
    assert "<Gather" not in xml


def test_the_conversation_cannot_run_forever(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(conversation, "reply", lambda history, context: answer())
    session = "conv-cap"
    last = ""
    for _ in range(conversation.MAX_TURNS + 4):
        last = speak(session, MILD)
    assert "<Hangup" in last and "<Gather" not in last, (
        "the call never ends. A stuck loop keeps a real phone line open and "
        "bills for every minute of it."
    )


def test_when_the_model_is_unreachable_the_call_still_closes_cleanly(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)

    def broken(history, context):
        raise RuntimeError("no network")

    monkeypatch.setattr(conversation, "reply", broken)
    xml = speak("conv-down", MILD)
    assert "<Hangup" in xml, "a model outage left the call hanging"
    assert "Response" in xml


def test_with_no_api_key_the_call_behaves_exactly_as_it_did_before(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: False)
    xml = speak("conv-unconfigured", MILD)
    assert "<Hangup" in xml
    assert "<Gather" not in xml


def test_a_worrying_answer_still_asks_before_booking(talking):
    xml = speak("conv-worry", WORRYING)
    assert "<Gather" in xml
    booked = [
        v for v in client.get("/followups/p1", headers=headers("conv-worry")).json()["visits"]
        if v["status"] == "booked" and v.get("source") == "check_in"
    ]
    assert not booked, "the triage branch booked without asking"


def test_the_model_is_not_asked_to_narrate_over_a_booking_it_did_not_make(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    calls = []

    def fake(history, context):
        calls.append(list(history))
        return answer(
            "While I cannot book the appointment directly, I would encourage "
            "you to reach out to your prescriber.",
        )

    monkeypatch.setattr(conversation, "reply", fake)
    session = "conv-no-contradiction"
    speak(session, WORRYING)
    xml = speak(session, "yes please")
    assert "cannot book" not in xml.lower(), (
        "the model was asked to comment on the same turn the system just "
        "confirmed a booking, and it contradicted the confirmation the "
        "patient just heard"
    )
    assert not calls, (
        "the model was called on the booking confirmation turn at all, "
        "which is exactly what produces the contradiction"
    )
    assert "booked you with" in xml


def test_saying_bye_ends_the_call_without_asking_the_model(talking):
    xml = speak("conv-bye", "okay, bye")
    assert not talking, "the model decides whether to keep talking on its own timing, so ending the call on a farewell must not depend on it"
    assert "<Hangup" in xml
    assert "<Gather" not in xml


def test_a_flagged_regimen_is_disclosed_in_the_models_context():
    context = conversation.build_context(
        {"name": "Test", "medication_requests": []}, None, ["warfarin", "aspirin"],
    )
    assert "flagged warfarin and aspirin" in context


def test_an_unflagged_regimen_tells_the_model_the_check_came_back_clean():
    context = conversation.build_context(
        {"name": "Test", "medication_requests": []}, None, None,
    )
    assert "found nothing worth flagging" in context


def test_declining_the_offer_also_skips_the_model(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    calls = []

    def fake(history, context):
        calls.append(list(history))
        return answer()

    monkeypatch.setattr(conversation, "reply", fake)
    session = "conv-decline-no-model"
    speak(session, WORRYING)
    speak(session, "no thanks")
    assert not calls, "the model was called on the decline turn"
