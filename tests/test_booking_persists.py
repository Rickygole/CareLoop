from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

WORRYING = "I have been dizzy for two days and my ankles are swollen"


def headers(name):
    return {"X-CareLoop-Session": name}


def booked(session, patient_id="p1"):
    body = client.get(f"/followups/{patient_id}", headers=headers(session)).json()
    return [v for v in body["visits"] if v["status"] == "booked"]


def check_in(session, transcript=WORRYING, patient_id="p1"):
    return client.post(
        "/loop/run",
        json={"patient_id": patient_id, "transcript": transcript},
        headers=headers(session),
    ).json()


def check_in_and_agree(session, transcript=WORRYING, patient_id="p1"):
    offered = check_in(session, transcript, patient_id)
    assert offered.get("booking") is None, (
        "the first turn must only offer, never book, because the patient has "
        "not answered the offer yet"
    )
    proposed = client.post(
        "/loop/run",
        json={"patient_id": patient_id, "transcript": "yes that works"},
        headers=headers(session),
    ).json()
    assert proposed.get("booking") is None, (
        "a specific slot must be proposed and confirmed before it is booked"
    )
    return client.post(
        "/loop/run",
        json={"patient_id": patient_id, "transcript": "yes that works"},
        headers=headers(session),
    ).json()


def test_a_booking_the_call_announced_appears_on_the_appointments_page():
    session = "persist-appears"
    before = booked(session)
    result = check_in_and_agree(session)

    assert result["booking"], "the check-in must produce a booking for this test to mean anything"
    announced = result["booking"]["provider_name"]

    after = booked(session)
    assert len(after) == len(before) + 1, (
        "the transcript said CareLoop booked an appointment and the appointments "
        "page did not change. A judge asks to see the booking they were just told "
        "about, and there is nothing to point at."
    )
    assert any(v["provider_name"] == announced for v in after), (
        f"the call announced {announced} and no visit with that provider exists"
    )


def test_the_booking_keeps_the_time_the_call_said():
    session = "persist-time"
    result = check_in_and_agree(session)
    said = result["booking"]["time"]
    match = [v for v in booked(session) if v.get("slot") == said]
    assert match, f"the call said {said} and no visit holds that time"
    assert match[0]["slot_local"], "the visit must render a human readable time"


def test_the_booking_says_it_came_from_a_check_in():
    session = "persist-source"
    check_in_and_agree(session)
    fresh = [v for v in booked(session) if v.get("source") == "check_in"]
    assert fresh, "a booking made during a check-in must be distinguishable from a seeded one"
    assert fresh[0]["disclosure"], "the simulated front desk disclosure must travel with it"


def test_two_check_ins_do_not_book_the_same_slot_twice():
    session = "persist-dedupe"
    check_in_and_agree(session)
    once = len(booked(session))
    check_in_and_agree(session, "still dizzy and my ankles are swollen")
    assert len(booked(session)) == once, "the same slot was booked twice"


def test_one_visitors_booking_never_shows_on_another_visitors_page():
    check_in_and_agree("persist-mine")
    mine = len(booked("persist-mine"))
    theirs = len(booked("persist-theirs"))
    assert theirs < mine, "a booking leaked between sessions"


def test_a_mild_answer_books_nothing_and_adds_nothing():
    session = "persist-mild"
    before = len(booked(session))
    result = check_in(session, "I took it and I feel completely fine")
    assert not result.get("booking"), "a mild answer must not book"
    assert len(booked(session)) == before
