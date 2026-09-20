import re

import pytest
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

WORRYING = "I have been dizzy for two days and my ankles are swollen"


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


def test_the_offer_alone_never_books():
    body = written("consent-offer", WORRYING)
    assert body["booking"] is None, (
        "the agent asked would that be okay and booked in the same breath, "
        "without the patient ever answering"
    )
    assert body["booking_offered"] is True
    assert "would that be okay" in body["triage"]["suggested_agent_response"]


@pytest.mark.parametrize("agreement", [
    "yes", "yes that works", "sure", "okay", "sounds good", "please do",
    "go ahead", "book it",
])
def test_a_clear_yes_books(agreement):
    session = "consent-yes-" + agreement.replace(" ", "")
    written(session, WORRYING)
    body = written(session, agreement)
    assert body["booking"], f"{agreement!r} should have booked"


@pytest.mark.parametrize("refusal", [
    "no", "no thanks", "not now", "I'd rather not", "I don't want to",
    "not interested",
])
def test_a_clear_no_does_not_book_and_is_acknowledged(refusal):
    session = "consent-no-" + refusal.replace(" ", "").replace("'", "")
    written(session, WORRYING)
    body = written(session, refusal)
    assert body["booking"] is None, f"{refusal!r} still booked an appointment"
    assert "I will not book anything" in body["triage"]["suggested_agent_response"], (
        "a refusal has to be acknowledged out loud, not silently dropped"
    )


@pytest.mark.parametrize("agreement", [
    "Yes please, I have no other questions",
    "Yes, book it. I have no insurance though",
    "Yeah go ahead, no rush",
    "Yes, no one else is home to drive me but I will manage",
    "Absolutely",
    "Definitely",
    "Mhm",
    "Uh huh",
])
def test_an_unrelated_no_elsewhere_in_a_yes_does_not_flip_it_to_a_decline(agreement):
    session = "consent-yes-unrelated-no-" + agreement[:10].replace(" ", "").replace(",", "").replace(".", "")
    written(session, WORRYING)
    body = written(session, agreement)
    assert body["booking"], (
        f"{agreement!r} is a clear yes, but an unrelated word elsewhere in the "
        "sentence that happens to contain no/not was read as a refusal"
    )


@pytest.mark.parametrize("refusal", [
    "absolutely not",
    "definitely not",
    "sure, not now actually",
])
def test_a_yes_word_immediately_reversed_still_declines(refusal):
    session = "consent-reversed-" + refusal.replace(" ", "").replace(",", "")
    written(session, WORRYING)
    body = written(session, refusal)
    assert body["booking"] is None, f"{refusal!r} should not have booked"


def test_an_unrelated_no_in_a_weak_yes_is_not_wrongly_treated_as_a_refusal():
    session = "consent-weak-yes-unrelated-no"
    written(session, WORRYING)
    body = written(session, "Sure, I have no preference")
    assert body["booking"] is None, "an unclear answer must never be treated as consent"
    assert "I will not book anything" not in body["triage"]["suggested_agent_response"], (
        "'no preference' has no bearing on the appointment itself and must not "
        "be read as the patient refusing it outright"
    )


def test_an_ambiguous_answer_books_nothing():
    session = "consent-ambiguous"
    written(session, WORRYING)
    body = written(session, "hmm, I am not sure")
    assert body["booking"] is None, (
        "an unclear answer must never be treated as consent"
    )


def test_a_new_symptom_is_not_mistaken_for_an_answer():
    session = "consent-newsymptom"
    written(session, WORRYING)
    body = written(session, "actually now my chest hurts")
    assert body["booking"] is None
    assert body["triage"]["is_emergency"] is True


def test_the_phone_offer_waits_for_an_answer_instead_of_hanging_up():
    xml = spoken("consent-phone-wait", WORRYING)
    assert "<Gather" in xml, (
        "the phone asked the appointment question and hung up without ever "
        "listening for the answer"
    )
    assert "would that be okay" in said_aloud(xml)


def test_the_phone_books_only_after_a_spoken_yes():
    session = "consent-phone-yes"
    spoken(session, WORRYING)
    xml = spoken(session, "yes that works")
    assert "I have booked you with" in said_aloud(xml)


def test_the_phone_acknowledges_a_spoken_no_without_booking():
    session = "consent-phone-no"
    spoken(session, WORRYING)
    xml = spoken(session, "no thanks")
    spokenText = said_aloud(xml)
    assert "I will not book anything" in spokenText
    assert "I have booked you with" not in spokenText


def test_silence_after_the_offer_books_nothing():
    session = "consent-phone-silent"
    xml = spoken(session, WORRYING)
    assert "I did not hear an answer, so I will not book anything" in said_aloud(xml)


def test_the_webhook_refuses_a_tool_call_with_no_agreement():
    body = {
        "tool_name": "book_appointment",
        "patient_id": "p1",
        "specialty": "Internal Medicine",
        "urgency": "routine",
        "transcript": "I am not sure about that",
    }
    expected = main.WEBHOOK_SECRET
    if expected:
        body["secret"] = expected
    r = client.post("/webhook/elevenlabs", json=body, headers=headers("consent-webhook"))
    assert r.status_code == 422, (
        "the tool booked an appointment from a transcript containing no "
        "agreement at all"
    )
