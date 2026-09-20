import re

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def headers(name):
    return {"X-CareLoop-Session": name}


def written(session, said):
    return client.post(
        "/loop/run", json={"patient_id": "p1", "transcript": said},
        headers=headers(session),
    ).json()


def spoken(session, said):
    return client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": said, "CallSid": "CA" + session},
        headers=headers(session),
    ).text


def said_aloud(xml):
    return " ".join(re.findall(r"<Say[^>]*>(.*?)</Say>", xml))


@pytest.mark.parametrize("request_phrase", [
    "can you book me an appointment",
    "I'd like to see a doctor",
    "I need an appointment",
    "could you schedule a follow-up",
])
def test_an_unprompted_booking_request_books_without_a_prior_offer(request_phrase):
    session = "unprompted-" + request_phrase.replace(" ", "")
    body = written(session, request_phrase)
    assert body["booking"], f"{request_phrase!r} should have booked on the first turn"
    assert body["booking_offered"] is False, (
        "an unprompted request should book directly, not just offer"
    )


def test_incidentally_mentioning_a_doctor_does_not_book():
    body = written("incidental-doctor", "My doctor prescribed a new blood pressure medication")
    assert body["booking"] is None, (
        "mentioning a doctor in passing must not be treated as a booking request"
    )


def test_declining_an_appointment_outright_does_not_book():
    body = written("decline-outright", "I don't want an appointment")
    assert body["booking"] is None


def test_the_offer_then_confirm_flow_still_works_after_adding_unprompted_support():
    session = "still-offer-confirm"
    offered = written(session, "I have been dizzy for two days and my ankles are swollen")
    assert offered["booking"] is None
    assert offered["booking_offered"] is True
    proposed = written(session, "yes that works")
    assert proposed["booking"] is None, "a specific slot must be proposed before booking"
    confirmed = written(session, "yes that works")
    assert confirmed["booking"], "the existing offer -> confirm path must keep working"


def test_the_phone_books_directly_from_an_unprompted_request():
    xml = spoken("phone-unprompted", "Can you book me an appointment")
    assert "I have booked you with" in said_aloud(xml)


def test_the_phone_does_not_book_from_an_incidental_mention_of_a_doctor():
    xml = spoken("phone-incidental", "My doctor prescribed a new blood pressure medication")
    spokenText = said_aloud(xml)
    assert "I have booked you with" not in spokenText


def test_the_phone_offer_then_confirm_flow_still_works():
    session = "phone-still-offer-confirm"
    xml = spoken(session, "I have been dizzy for two days and my ankles are swollen")
    assert "would that be okay" in said_aloud(xml)
    xml2 = spoken(session, "yes that works")
    assert "I have booked you with" not in said_aloud(xml2), (
        "a specific slot must be proposed before booking"
    )
    xml3 = spoken(session, "yes that works")
    assert "I have booked you with" in said_aloud(xml3)


def test_the_webhook_books_an_unprompted_tool_call_without_a_prior_offer():
    body = {
        "tool_name": "book_appointment",
        "patient_id": "p1",
        "specialty": "Internal Medicine",
        "urgency": "routine",
        "transcript": "Can you book me an appointment",
    }
    expected = main.WEBHOOK_SECRET
    if expected:
        body["secret"] = expected
    r = client.post("/webhook/elevenlabs", json=body, headers=headers("webhook-unprompted"))
    assert r.status_code == 200
    assert r.json()["confirmed"] is True
