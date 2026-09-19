import pytest
from fastapi.testclient import TestClient

import main
import portal

client = TestClient(main.app)


def headers(name):
    return {"X-CareLoop-Session": name}


def sync(session, patient_id="p2", accept=False):
    return client.post(
        "/portal/sync",
        json={"patient_id": patient_id, "accept_portal_changes": accept},
        headers=headers(session),
    ).json()


def resources_of(bundle, kind):
    return [e["resource"] for e in bundle["entry"] if e["resource"]["resourceType"] == kind]


def test_sync_returns_a_fhir_shaped_bundle():
    body = sync("portal-bundle")
    bundle = body["bundle"]
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert bundle["total"] == len(bundle["entry"])
    assert all("fullUrl" in entry and "resource" in entry for entry in bundle["entry"])


def test_the_bundle_carries_every_category_the_consent_screen_promises():
    body = sync("portal-categories")
    bundle = body["bundle"]
    assert body["shared"] == portal.SHARED_CATEGORIES
    assert resources_of(bundle, "MedicationRequest")
    assert resources_of(bundle, "AllergyIntolerance")
    patient = resources_of(bundle, "Patient")[0]
    window = patient["extension"][0]["valuePeriod"]
    assert window["start"] and window["end"]


def test_a_medication_request_has_the_fields_a_client_would_read():
    body = sync("portal-medreq")
    request = resources_of(body["bundle"], "MedicationRequest")[0]
    assert request["intent"] == "order"
    assert request["status"] == "active"
    assert request["medicationCodeableConcept"]["text"]
    assert request["subject"]["reference"].startswith("Patient/")
    repeat = request["dosageInstruction"][0]["timing"]["repeat"]
    assert repeat["periodUnit"] == "d"
    assert repeat["timeOfDay"]


def test_the_first_sync_is_reported_as_a_first_sync():
    body = sync("portal-first")
    assert body["diff"]["first_sync"] is True
    assert body["diff"]["changed"] is False


def test_an_unchanged_resync_recomputes_nothing():
    session = "portal-unchanged"
    first = sync(session)
    again = sync(session)
    assert again["diff"]["changed"] is False
    assert again["regimen"]["content_hash"] == first["regimen"]["content_hash"]
    assert again["schedule"]["doses_total"] == first["schedule"]["doses_total"]


def test_a_portal_side_change_recomputes_the_schedule_and_the_checks():
    session = "portal-changed"
    before = sync(session)
    sync(session)
    after = sync(session, accept=True)

    assert after["diff"]["changed"] is True
    assert [r["medication"] for r in after["diff"]["added"]] == ["Spironolactone"]
    assert after["regimen"]["content_hash"] != before["regimen"]["content_hash"]
    assert after["schedule"]["doses_total"] > before["schedule"]["doses_total"]
    assert [f["ingredients"] for f in after["regimen"]["surfaced"]] == [
        ["lisinopril", "spironolactone"]
    ]


def test_the_change_is_announced_on_the_trace():
    session = "portal-trace"
    sync(session)
    sync(session, accept=True)
    types = [
        e["event_type"]
        for e in client.get("/trace/events?since=0", headers=headers(session)).json()["events"]
    ]
    assert "PORTAL_SYNC" in types
    assert "REGIMEN_SNAPSHOT" in types
    assert "SCHEDULE_RECOMPUTED" in types
    assert "CONTRADICTION_FLAGGED" in types


def test_the_same_change_is_not_applied_twice():
    session = "portal-idempotent"
    sync(session)
    once = sync(session, accept=True)
    twice = sync(session, accept=True)
    assert once["diff"]["changed"] is True
    assert twice["diff"]["changed"] is False
    assert twice["portal_has_pending_change"] is False


def test_one_session_cannot_see_another_session_regimen():
    sync("portal-isolation-a")
    changed = sync("portal-isolation-a", accept=True)
    fresh = sync("portal-isolation-b")
    assert changed["schedule"]["doses_total"] != fresh["schedule"]["doses_total"]
    assert fresh["diff"]["first_sync"] is True


def test_an_unknown_patient_is_rejected():
    r = client.post("/portal/sync", json={"patient_id": "nobody"}, headers=headers("portal-404"))
    assert r.status_code == 404


def test_the_sync_states_what_it_is_not():
    body = sync("portal-limits")
    assert "not validated" in body["limitations"]


@pytest.mark.parametrize("patient_id", ["p1", "p2"])
def test_every_patient_syncs_without_typing_anything(patient_id):
    body = sync(f"portal-all-{patient_id}", patient_id=patient_id)
    assert body["medications"]
    assert body["preferred_contact_window"]
    assert body["schedule"]["doses_total"] > 0


def test_diff_reports_a_removed_medication():
    before = [
        {"medication_id": "a", "medication": "Metformin", "dosage_text": "500mg",
         "frequency": "twice daily", "status": "active"},
        {"medication_id": "b", "medication": "Lisinopril", "dosage_text": "10mg",
         "frequency": "once daily", "status": "active"},
    ]
    after = before[:1]
    diff = portal.diff_regimen(before, after)
    assert diff["changed"] is True
    assert [r["medication"] for r in diff["removed"]] == ["Lisinopril"]
    assert "no longer on the list" in portal.describe_diff(diff)


def test_diff_reports_a_changed_dose():
    before = [{"medication_id": "a", "medication": "Metformin", "dosage_text": "500mg",
               "frequency": "twice daily", "status": "active"}]
    after = [{"medication_id": "a", "medication": "Metformin", "dosage_text": "1000mg",
              "frequency": "twice daily", "status": "active"}]
    diff = portal.diff_regimen(before, after)
    assert diff["changed"] is True
    assert diff["modified"][0]["after"]["dosage_text"] == "1000mg"


def test_a_stopped_medication_is_not_treated_as_active():
    before = [{"medication_id": "a", "medication": "Metformin", "dosage_text": "500mg",
               "frequency": "twice daily", "status": "active"}]
    after = [{"medication_id": "a", "medication": "Metformin", "dosage_text": "500mg",
              "frequency": "twice daily", "status": "stopped"}]
    diff = portal.diff_regimen(before, after)
    assert [r["medication"] for r in diff["removed"]] == ["Metformin"]
