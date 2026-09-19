import re

import pytest
from fastapi.testclient import TestClient

import followup
import main
import telephony

client = TestClient(main.app)


def gated(payload=None):
    body = dict(payload or {})
    expected = main.CALL_TOKEN or main.WEBHOOK_SECRET
    if expected:
        body["secret"] = expected
    return body


def headers(name):
    return {"X-CareLoop-Session": name}


def said(xml):
    return " ".join(re.findall(r"<Say[^>]*>(.*?)</Say>", xml))


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC" + "0" * 32)
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "x" * 32)
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15550001111")
    monkeypatch.setenv("DEMO_PHONE_NUMBER", "+15550002222")


@pytest.fixture
def dialled(monkeypatch):
    placed = []

    def fake_place_call(to, twiml_url=None, twiml=None, **kw):
        placed.append({"to": to, "twiml_url": twiml_url})
        return {"ok": True, "call_sid": "CAreminder", "status": "queued"}

    monkeypatch.setattr(telephony, "place_call", fake_place_call)
    return placed


def booked_visits(patient_id, session):
    body = client.get(f"/followups/{patient_id}", headers=headers(session)).json()
    return [v for v in body["visits"] if v["status"] == followup.STATUS_BOOKED]


def test_followups_books_a_visit_from_a_prescriber_note():
    body = client.get("/followups/p1", headers=headers("fu-book")).json()
    assert body["booked_count"] >= 1
    visit = next(v for v in body["visits"] if v["status"] == followup.STATUS_BOOKED)
    assert visit["provider_name"]
    assert visit["in_network"] is True
    assert visit["note_id"]
    assert visit["reason"].startswith(visit["prescriber"])


def test_a_booked_visit_carries_both_reminder_calls():
    visit = booked_visits("p1", "fu-reminders")[0]
    kinds = [r["kind"] for r in visit["reminders"]]
    assert followup.KIND_DAY_BEFORE in kinds
    assert followup.KIND_SAME_DAY in kinds


def test_a_visit_is_never_booked_out_of_network():
    for patient_id in ("p1", "p2"):
        body = client.get(f"/followups/{patient_id}", headers=headers(f"fu-net-{patient_id}")).json()
        for visit in body["visits"]:
            if visit["status"] == followup.STATUS_BOOKED:
                assert visit["in_network"] is True
            else:
                assert visit["provider_name"] is None


def test_a_payer_with_no_in_network_specialist_is_reported_not_hidden():
    body = client.get("/followups/p2", headers=headers("fu-nonetwork")).json()
    blocked = [v for v in body["visits"] if v["status"] == followup.STATUS_UNBOOKABLE]
    assert blocked
    assert blocked[0]["issue"] == followup.ISSUE_NO_IN_NETWORK_PROVIDER
    assert blocked[0]["issue_detail"]


def test_followups_reports_the_payer_and_the_contact_window():
    body = client.get("/followups/p2", headers=headers("fu-payer")).json()
    assert body["payer_display"] == "CareFirst BlueCross"
    assert body["preferred_contact_window"]["start"]


def test_an_unknown_patient_is_rejected():
    assert client.get("/followups/nobody", headers=headers("fu-404")).status_code == 404


@pytest.mark.parametrize("kind", [followup.KIND_DAY_BEFORE, followup.KIND_SAME_DAY])
def test_the_reminder_call_says_who_what_and_when(kind):
    visit = booked_visits("p1", f"fu-voice-{kind}")[0]
    xml = client.get(
        f"/voice/reminder?patient_id=p1&note_id={visit['note_id']}&kind={kind}",
        headers=headers(f"fu-voice-{kind}"),
    ).text
    spoken = said(xml)
    assert visit["patient_first_name"] in spoken
    assert visit["provider_name"] in spoken
    assert "automated call" in spoken
    assert "reminder only" in spoken


def test_the_reminder_call_never_changes_a_medicine():
    visit = booked_visits("p1", "fu-noadvice")[0]
    xml = client.get(
        f"/voice/reminder?patient_id=p1&note_id={visit['note_id']}&kind=day_before",
        headers=headers("fu-noadvice"),
    ).text
    assert "Nothing about your medicines changes" in said(xml)


def test_a_reminder_for_an_unknown_note_does_not_invent_an_appointment():
    xml = client.get(
        "/voice/reminder?patient_id=p1&note_id=does-not-exist&kind=day_before",
        headers=headers("fu-unknown-note"),
    ).text
    assert "no appointment reminder" in said(xml).lower()


def test_placing_a_reminder_call_dials_only_the_demo_number(configured, dialled):
    r = client.post(
        "/call/reminder",
        json=gated({"patient_id": "p1", "kind": "day_before"}),
        headers=headers("fu-call"),
    )
    assert r.status_code == 200
    assert r.json()["ok"] is True
    assert [c["to"] for c in dialled] == ["+15550002222"]
    assert "/voice/reminder?" in dialled[0]["twiml_url"]


def test_a_reminder_call_picks_the_booked_visit_when_no_note_is_named(configured, dialled):
    r = client.post("/call/reminder", json=gated({"patient_id": "p1"}), headers=headers("fu-call-auto"))
    assert r.status_code == 200
    assert r.json()["note_id"]


def test_reminder_calls_are_rate_limited(configured, dialled):
    session = headers("fu-call-limit")
    codes = []
    for _ in range(telephony.PER_MINUTE_LIMIT + 2):
        codes.append(
            client.post("/call/reminder", json=gated({"patient_id": "p1"}), headers=session).status_code
        )
    assert 429 in codes


def test_a_reminder_call_is_refused_when_telephony_is_not_configured(monkeypatch):
    for name in telephony.REQUIRED_ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    body = client.post("/call/reminder", json=gated({"patient_id": "p1"}), headers=headers("fu-unconf")).json()
    assert body["configured"] is False
    assert body["missing_env"]
