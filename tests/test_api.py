import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app

client = TestClient(app)


def test_connect_returns_patient_and_derived_schedule():
    body = client.post("/portal/connect", json={"patient_id": "p1"}).json()
    assert body["patient"]["name"] == "Maria Santos"
    assert body["patient"]["connected"] is True

    times = [s["time"] for s in body["derived_schedule"]]
    assert times == ["08:00", "20:00"]


def test_connect_flattens_multiple_medications():
    body = client.post("/portal/connect", json={"patient_id": "p4"}).json()
    assert len(body["patient"]["medication_requests"]) == 2
    assert len(body["derived_schedule"]) == 3


def test_connect_unknown_patient_is_404():
    assert client.post("/portal/connect", json={"patient_id": "nope"}).status_code == 404


REQUIRED_TRIAGE_FIELDS = {
    "tier",
    "source",
    "normalized_text",
    "confidence",
    "reasoning",
    "suggested_agent_response",
    "is_crisis",
    "is_emergency",
    "matched_rules",
    "patient_id",
    "transcript",
}


def test_triage_response_has_every_contract_field():
    body = client.post("/triage", json={"transcript": "feeling alright", "patient_id": "p1"}).json()
    assert REQUIRED_TRIAGE_FIELDS.issubset(body.keys())


def test_triage_tier_is_lowercase_for_the_frontend():
    body = client.post("/triage", json={"transcript": "my chest is killing me"}).json()
    assert body["tier"] == "emergency"
    assert body["source"] == "rule"


def test_emergency_returns_a_usable_agent_response():
    body = client.post("/triage", json={"transcript": "I can't breathe"}).json()
    assert body["is_emergency"] is True
    assert "911" in body["suggested_agent_response"]


def test_crisis_response_offers_988_and_does_not_say_911():
    body = client.post("/triage", json={"transcript": "I want to die"}).json()
    assert body["is_crisis"] is True
    assert "988" in body["suggested_agent_response"]
    assert "911" not in body["suggested_agent_response"]


def test_smart_apostrophe_still_reaches_emergency_through_the_api():
    body = client.post("/triage", json={"transcript": "I can\u2019t breathe"}).json()
    assert body["tier"] == "emergency"


def test_negated_symptom_does_not_escalate_through_the_api():
    body = client.post("/triage", json={"transcript": "no chest pain today"}).json()
    assert body["tier"] != "emergency"


def test_book_matches_specialty_and_payer():
    body = client.post(
        "/book",
        json={
            "specialty": "Internal Medicine",
            "urgency": "routine",
            "patient_id": "p1",
        },
    ).json()
    assert body["confirmed"] is True
    assert body["provider_name"] == "Dr. Elena Vance"


def test_booking_is_repeatable_across_demo_runs():
    payload = {"specialty": "Internal Medicine", "urgency": "routine", "patient_id": "p1"}
    first = client.post("/book", json=payload).json()
    for _ in range(5):
        again = client.post("/book", json=payload).json()
        assert again == first


def test_out_of_network_specialty_is_refused():
    r = client.post(
        "/book",
        json={
            "specialty": "Cardiology",
            "urgency": "routine",
            "patient_id": "p1",
        },
    )
    assert r.status_code == 404


def test_emergency_medicine_is_never_bookable():
    r = client.post(
        "/book",
        json={
            "specialty": "Emergency Medicine",
            "urgency": "urgent",
            "patient_id": "p1",
        },
    )
    assert r.status_code == 409


def test_invalid_urgency_is_rejected():
    r = client.post("/book", json={"specialty": "Internal Medicine", "urgency": "whenever"})
    assert r.status_code == 400


def test_webhook_report_symptom_runs_triage():
    body = client.post(
        "/webhook/elevenlabs",
        json={
            "tool_name": "report_symptom",
            "patient_id": "p1",
            "transcript": "I can't breathe",
        },
    ).json()
    assert body["tier"] == "emergency"


def test_webhook_unknown_patient_is_404():
    r = client.post(
        "/webhook/elevenlabs",
        json={
            "tool_name": "report_symptom",
            "patient_id": "ghost",
            "transcript": "hi",
        },
    )
    assert r.status_code == 404


def test_webhook_rejects_unknown_tool():
    r = client.post("/webhook/elevenlabs", json={"tool_name": "drop_tables", "patient_id": "p1"})
    assert r.status_code == 400


def test_triage_emits_trace_events_in_order():
    before = client.get("/trace/events?since=0").json()["events"]
    cursor = before[-1]["seq"] if before else 0
    client.post("/triage", json={"transcript": "my chest is killing me", "patient_id": "p1"})
    new = client.get(f"/trace/events?since={cursor}").json()["events"]
    types = [e["event_type"] for e in new]
    assert "PATIENT_SPEECH" in types
    assert "TIER_0_CHECK" in types
    assert "TIER_0_MATCH" in types
    assert "EMERGENCY_ESCALATION" in types


def test_trace_events_are_monotonic():
    events = client.get("/trace/events?since=0").json()["events"]
    seqs = [e["seq"] for e in events]
    assert seqs == sorted(seqs)


def test_health_reports_key_status():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["patients_loaded"] == 4
    assert "gemini_configured" in body
