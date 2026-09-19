import re

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)

CRISIS = "i want to kill myself"
EMERGENCY = "my chest is crushing and my arm is numb"
ROUTINE = "i took it, feeling fine"


def respond(transcript, session, patient_id="p1"):
    return client.post(
        f"/voice/checkin/respond?patient_id={patient_id}",
        data={"SpeechResult": transcript, "CallSid": "CA" + session},
        headers={"X-CareLoop-Session": session},
    ).text


def said(xml):
    return " ".join(re.findall(r"<Say[^>]*>(.*?)</Say>", xml))


def escalations(session, patient_id="p1"):
    body = client.get(
        f"/escalations/{patient_id}", headers={"X-CareLoop-Session": session}
    ).json()
    return body["escalations"] if isinstance(body, dict) else body


def test_a_crisis_call_is_never_hung_up():
    xml = respond(CRISIS, "safety-crisis-hangup")
    assert "<Hangup/>" not in xml


def test_a_crisis_call_does_not_tell_the_patient_to_take_their_medication():
    spoken = said(respond(CRISIS, "safety-crisis-meds"))
    assert "keep taking your medication" not in spoken
    assert "Take care" not in spoken


def test_a_crisis_call_keeps_its_promise_to_stay_on_the_line():
    spoken = said(respond(CRISIS, "safety-crisis-promise"))
    assert "staying on the line" in spoken
    assert "988" in spoken


def test_a_crisis_on_the_phone_is_recorded_as_an_escalation():
    session = "safety-crisis-escalation"
    respond(CRISIS, session)
    assert len(escalations(session)) == 1


def test_an_emergency_call_does_not_tell_the_patient_to_take_their_medication():
    spoken = said(respond(EMERGENCY, "safety-emergency-meds"))
    assert "keep taking your medication" not in spoken


def test_an_emergency_call_ends_so_the_line_is_free():
    xml = respond(EMERGENCY, "safety-emergency-hangup")
    assert "<Hangup/>" in xml
    assert "911" in said(xml)


def test_an_emergency_on_the_phone_is_recorded_as_an_escalation():
    session = "safety-emergency-escalation"
    respond(EMERGENCY, session)
    assert len(escalations(session)) == 1


def test_a_routine_call_still_closes_normally():
    session = "safety-routine"
    xml = respond(ROUTINE, session)
    spoken = said(xml)
    assert "<Hangup/>" in xml
    assert "keep taking your medication" in spoken
    assert escalations(session) == []


def test_the_greeting_never_reads_another_patient_record_by_accident():
    xml = client.get(
        "/voice/checkin?patient_id=p1", headers={"X-CareLoop-Session": "safety-who"}
    ).text
    assert "Maria" in said(xml)
    assert "Dorothy" not in said(xml)


def test_every_callback_url_in_the_twiml_is_absolute():
    xml = client.get(
        "/voice/checkin?patient_id=p1", headers={"X-CareLoop-Session": "absolute-urls"}
    ).text
    targets = re.findall(r'(?:action|url)="([^"]+)"', xml)
    assert targets, "the gather must post somewhere"
    for target in targets:
        assert target.startswith("http"), (
            f"{target} is relative. Twilio resolves it against the host root, which drops "
            "the /api prefix the deployment routes on, and the caller hears an error."
        )


def test_a_runaway_medication_name_is_not_read_out_in_full():
    session = "spoken-clamp"
    long_name = "Metformin " + "extended release hydrochloride " * 30
    client.post(
        "/meds",
        json={"patient_id": "p1", "medication": long_name, "dosage_text": "500mg",
              "frequency": "once daily", "preferred_hours": [9], "prescriber": "Dr X"},
        headers={"X-CareLoop-Session": session},
    )
    spoken = said(
        client.get("/voice/checkin?patient_id=p1", headers={"X-CareLoop-Session": session}).text
    )
    assert len(spoken) < 900, f"the call would read {len(spoken)} characters aloud"


def test_the_activity_log_is_not_readable_without_the_token():
    if not main.WEBHOOK_SECRET:
        return
    r = client.get("/trace/events?since=0", headers={"X-CareLoop-Session": "trace-noauth"})
    assert r.status_code == 403


def test_the_activity_log_opens_with_the_token():
    token = f"&token={main.WEBHOOK_SECRET}" if main.WEBHOOK_SECRET else ""
    r = client.get(
        f"/trace/events?since=0{token}", headers={"X-CareLoop-Session": "trace-auth"}
    )
    assert r.status_code == 200
    assert "events" in r.json()


def test_the_crisis_line_actually_stays_open():
    xml = respond(CRISIS, "hold-open")
    assert "<Hangup/>" not in xml
    assert "<Redirect>" in xml, (
        "without a redirect the TwiML document simply ends and Twilio drops the "
        "call, so the promise to stay on the line lasts about forty seconds"
    )


def test_the_crisis_hold_redirect_is_absolute():
    xml = respond(CRISIS, "hold-absolute")
    target = re.search(r"<Redirect>([^<]+)</Redirect>", xml).group(1)
    assert target.startswith("http"), (
        f"{target} is relative, so the deployment would drop the /api prefix and "
        "the hold would fail at exactly the wrong moment"
    )


def test_the_hold_loop_repeats_rather_than_ending():
    body = client.post(
        "/voice/checkin/hold?patient_id=p1", headers={"X-CareLoop-Session": "hold-loop"}
    ).text
    assert "<Redirect>" in body, "the hold must loop, not run out"
    assert "988" in said(body)
    assert "<Hangup/>" not in body


def test_the_call_never_claims_a_later_dose_is_due_now():
    for patient_id in ("p1", "p2"):
        xml = client.get(
            f"/voice/checkin?patient_id={patient_id}",
            headers={"X-CareLoop-Session": f"timing-{patient_id}"},
        ).text
        spoken = said(xml)
        plan_due = "due at about this time" in spoken
        later = "due later today" in spoken
        assert plan_due or later, f"{patient_id} did not say when the dose is due"
        assert not (plan_due and later), "the call cannot say both"
