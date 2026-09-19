from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def headers(name):
    return {"X-CareLoop-Session": name}


def taken(session, patient_id="p1"):
    body = client.get(f"/regimen/{patient_id}", headers=headers(session)).json()
    return body["schedule"]["doses_taken"]


def by_phone(session, said):
    return client.post(
        "/voice/checkin/respond?patient_id=p1",
        data={"SpeechResult": said, "CallSid": "CA" + session},
        headers=headers(session),
    )


def in_writing(session, said):
    return client.post(
        "/loop/run", json={"patient_id": "p1", "transcript": said}, headers=headers(session)
    ).json()


def test_a_confirmation_with_an_unrelated_negative_clause_still_counts():
    for said in [
        "Yes I took it, no side effects",
        "I took my Coumadin, no problems at all",
        "Taken, no issues to report",
    ]:
        session = "neg-clean-" + said[:8].replace(" ", "").replace(",", "")
        before = taken(session)
        in_writing(session, said)
        assert taken(session) == before + 1, f"{said!r} was wrongly read as a refusal"


def test_a_real_refusal_still_records_nothing():
    for said in [
        "I have not taken it yet",
        "I did not take it",
        "I skipped my dose this morning",
        "I forgot to take it",
        "no",
        "No.",
    ]:
        session = "neg-refuse-" + said[:8].replace(" ", "").replace(".", "")
        before = taken(session)
        in_writing(session, said)
        assert taken(session) == before, f"{said!r} was wrongly recorded as taken"


def test_the_phone_call_writes_an_episode_the_next_call_can_see():
    session = "phone-memory"
    by_phone(session, "I stopped taking my Coumadin because it made me bruise")
    result = in_writing(session, "I am taking it every day now, as prescribed")
    assert result.get("prior_episode"), (
        "the phone check-in never wrote a memory episode, so the very next call "
        "has no idea the first one happened"
    )
    assert result.get("cross_call_findings"), (
        "the contradiction between the two calls was not detected"
    )


def test_a_routine_phone_answer_is_remembered_too():
    session = "phone-routine"
    by_phone(session, "I took it and I feel fine")
    result = in_writing(session, "still feeling fine")
    assert result.get("prior_episode")


def test_the_written_stand_in_never_claims_a_call_was_placed_to_the_clinic():
    src = open("frontend/src/components/SimulatedCall.jsx").read()
    assert "I have rung the clinic" not in src, (
        "the written check-in claimed a real telephone call to the clinic "
        "happened, when call_clinic defaults to false on that path and no "
        "call was placed"
    )
