import re

from fastapi.testclient import TestClient

import followup
import main

client = TestClient(main.app)

WORRYING = "I have been dizzy for two days and my ankles are swollen"

FIRST_SLOT = "2026-09-20T14:00:00Z"
SECOND_SLOT = "2026-09-20T19:00:00Z"
THIRD_SLOT = "2026-09-22T13:00:00Z"


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


def test_agreeing_to_an_appointment_proposes_a_specific_slot_before_booking_it():
    session = "negotiation-propose"
    written(session, WORRYING)
    proposed = written(session, "yes that works")
    assert proposed["booking"] is None, (
        "a specific slot must be proposed and confirmed before anything is "
        "booked, the patient never heard a time yet"
    )
    assert "Vance" in proposed["triage"]["suggested_agent_response"]
    assert "Does that work" in proposed["triage"]["suggested_agent_response"]


def test_accepting_the_proposed_slot_books_exactly_that_slot():
    session = "negotiation-accept-first"
    written(session, WORRYING)
    written(session, "yes that works")
    body = written(session, "yes that works")
    assert body["booking"], "accepting the proposed slot should book it"
    assert body["booking"]["time"] == FIRST_SLOT


def test_saying_im_busy_offers_a_different_slot_that_excludes_the_first():
    session = "negotiation-busy"
    written(session, WORRYING)
    proposed = written(session, "yes that works")
    assert proposed["booking"] is None
    busy = written(session, "I'm busy then")
    assert busy["booking"] is None, (
        "saying the proposed time does not work must not be read as a decline"
    )
    reply = busy["triage"]["suggested_agent_response"]
    assert "How about" in reply
    assert followup.format_slot(SECOND_SLOT) in reply
    assert followup.format_slot(FIRST_SLOT) not in reply, (
        "the re-offer must not repeat the slot the patient just said does "
        "not work"
    )


def test_accepting_the_second_offered_slot_books_the_second_slot_not_the_first():
    session = "negotiation-accept-second"
    written(session, WORRYING)
    written(session, "yes that works")
    written(session, "I'm busy then")
    body = written(session, "yes that works")
    assert body["booking"], "accepting the second offer should book it"
    assert body["booking"]["time"] == SECOND_SLOT
    assert body["booking"]["time"] != FIRST_SLOT


def test_exhausting_the_offer_cap_falls_back_without_booking_anything():
    session = "negotiation-exhausted"
    written(session, WORRYING)
    written(session, "yes that works")
    written(session, "I'm busy then")
    third = written(session, "I'm busy then")
    assert third["booking"] is None
    assert "How about" in third["triage"]["suggested_agent_response"]

    exhausted = written(session, "I'm busy then")
    assert exhausted["booking"] is None, (
        "the negotiation must never book once the offer cap is hit"
    )
    assert "please call the clinic yourself" in exhausted["triage"]["suggested_agent_response"]

    again = written(session, "yes that works")
    assert again["booking"] is None, (
        "once the negotiation gave up, a later yes must not resurrect a stale "
        "pending offer and book something the patient never heard about"
    )


def test_declining_after_a_slot_was_already_proposed_still_cancels_cleanly():
    session = "negotiation-decline-after-propose"
    written(session, WORRYING)
    written(session, "yes that works")
    body = written(session, "no, don't book me")
    assert body["booking"] is None
    assert "I will not book anything" in body["triage"]["suggested_agent_response"]

    again = written(session, "yes that works")
    assert again["booking"] is None, (
        "a fresh yes after a full decline must not silently book the old "
        "proposed slot"
    )


def test_the_phone_offers_a_different_time_when_the_first_one_is_busy():
    session = "negotiation-phone-busy"
    spoken(session, WORRYING)
    spoken(session, "yes that works")
    xml = spoken(session, "I can't make it")
    spokenText = said_aloud(xml)
    assert "I have booked you with" not in spokenText
    assert "How about" in spokenText

    booked_xml = spoken(session, "yes that works")
    booked = said_aloud(booked_xml)
    assert "I have booked you with" in booked
