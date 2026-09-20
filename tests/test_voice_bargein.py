import re

from fastapi.testclient import TestClient

import conversation
import main

client = TestClient(main.app)

WORRYING = "I have been dizzy for two days and my ankles are swollen"
EMERGENCY = "I have crushing chest pain and my left arm is numb"
MILD = "I took it and I feel completely fine"


def headers(name):
    return {"X-CareLoop-Session": name}


def respond(transcript, session, patient_id="p1"):
    return client.post(
        f"/voice/checkin/respond?patient_id={patient_id}",
        data={"SpeechResult": transcript, "CallSid": "CA" + session},
        headers=headers(session),
    ).text


def gather_bodies(xml):
    return re.findall(r"<Gather[^>]*>(.*?)</Gather>", xml)


def test_the_dose_question_starts_listening_before_it_finishes_speaking():
    xml = client.get(
        "/voice/checkin?patient_id=p1", headers=headers("bargein-opener")
    ).text
    bodies = gather_bodies(xml)
    assert bodies, "the opening question must be wrapped in a Gather"
    assert re.match(r"<Say[^>]*>", bodies[0]), (
        "the Say must be the first thing inside the Gather, otherwise Twilio "
        "waits for it to finish before it starts listening and the patient "
        "cannot cut in"
    )


def test_the_mandatory_disclosure_still_finishes_before_anything_can_interrupt_it():
    xml = client.get(
        "/voice/checkin?patient_id=p1", headers=headers("bargein-disclosure")
    ).text
    before_gather = xml.split("<Gather", 1)[0]
    assert "<Say" in before_gather, (
        "the automated-assistant disclosure must be spoken in full before the "
        "Gather opens, so it stays a one-way statement rather than something "
        "the patient can talk over"
    )


def test_the_conversational_follow_up_can_be_talked_over(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(
        conversation, "reply",
        lambda history, context: {
            "say": "Tell me more about that.", "end_call": False, "offer_booking": False,
        },
    )
    xml = respond(MILD, "bargein-followup")
    bodies = gather_bodies(xml)
    assert bodies, "the follow-up question must be wrapped in a Gather"
    assert re.match(r"<Say[^>]*>", bodies[0]), (
        "the follow-up question is nested outside the Gather, so the patient "
        "has to wait for the agent to stop talking before they can answer"
    )


def test_the_appointment_offer_can_be_talked_over():
    xml = respond(WORRYING, "bargein-offer")
    bodies = gather_bodies(xml)
    assert bodies, "the appointment offer must be wrapped in a Gather"
    assert re.match(r"<Say[^>]*>", bodies[0]), (
        "the appointment offer is nested outside the Gather, so a patient who "
        "immediately says yes gets talked over instead of heard"
    )


def test_the_final_goodbye_has_nothing_left_to_interrupt(monkeypatch):
    monkeypatch.setattr(conversation, "is_configured", lambda: False)
    xml = respond(MILD, "bargein-goodbye")
    assert "<Gather" not in xml
    assert "<Hangup" in xml


def test_the_emergency_closing_has_nothing_left_to_interrupt():
    xml = respond(EMERGENCY, "bargein-emergency")
    assert "<Gather" not in xml
    assert "<Hangup" in xml
