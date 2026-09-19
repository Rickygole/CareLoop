from datetime import datetime

import pytest
from fastapi.testclient import TestClient

import main
from contradiction import active_ingredients, check_regimen
from scheduler import build_day_plan, clinic_timezone

client = TestClient(main.app)


def at(hour):
    return datetime.now(clinic_timezone()).replace(hour=hour, minute=0, second=0, microsecond=0)


def test_the_guard_fires_on_the_real_record_not_a_stubbed_one():
    patient = main.BASELINE_PATIENTS["p1"]
    surfaced = [f for f in check_regimen(patient["medication_requests"]) if f["surfaced"]]
    assert surfaced, "the seed record must surface a finding for this test to mean anything"
    assert main._next_dose_is_flagged(patient) == ["warfarin", "aspirin"], (
        "the interaction check resolves Coumadin to warfarin, so the guard must too"
    )


def test_a_brand_name_dose_is_still_recognised_as_flagged():
    patient = {
        "name": "Test Patient",
        "medication_requests": [
            {"medication_id": "m1", "medication": "Coumadin", "dosage_text": "5mg",
             "frequency": "once daily", "timing": {"times_per_day": 1, "preferred_hours": [18]},
             "prescriber": "Dr X", "status": "active", "indication": "to thin your blood"},
            {"medication_id": "m2", "medication": "Aspirin", "dosage_text": "81mg",
             "frequency": "once daily", "timing": {"times_per_day": 1, "preferred_hours": [18]},
             "prescriber": "Dr X", "status": "active", "indication": "to lower clot risk"},
        ],
        "history": [],
    }
    assert main._next_dose_is_flagged(patient) == ["warfarin", "aspirin"]


def test_a_negated_name_never_fabricates_a_finding():
    for negated in ["Aspirin-Free Excedrin", "Aspirin Free Excedrin", "No aspirin formula"]:
        resolved = active_ingredients([{"medication": negated, "status": "active"}])
        assert "aspirin" not in resolved, f"{negated!r} resolved to {resolved!r}"
        findings = check_regimen([
            {"medication": "Coumadin 5mg", "status": "active"},
            {"medication": negated, "status": "active"},
        ])
        assert findings == [], f"{negated!r} fabricated {findings!r}"


def test_the_real_pair_still_fires_after_the_negation_guard():
    findings = check_regimen([
        {"medication": "Coumadin 5mg", "status": "active"},
        {"medication": "Aspirin 81mg", "status": "active"},
    ])
    assert [f["ingredients"] for f in findings] == [["warfarin", "aspirin"]]


def test_no_spoken_path_pushes_a_flagged_dose_on_the_real_record():
    import re

    session = "guard-real"
    headers = {"X-CareLoop-Session": session}
    patient = main.SESSIONS.get(session).patients["p1"]
    plan = build_day_plan(patient, at(18))
    if not plan["next_dose"] or plan["next_dose"]["medication"].lower() != "coumadin":
        pytest.skip("the flagged medicine is not the next dose at this hour")

    xml = client.get("/voice/checkin?patient_id=p1", headers=headers).text
    spoken = " ".join(re.findall(r"<Say[^>]*>(.*?)</Say>", xml)).lower()
    assert "reminder to take your" not in spoken
    assert "i am not going to ask you to take it" in spoken
