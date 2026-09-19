import main
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import telephony
from clinic import FRONT_DESK_DISCLOSURE
from main import SESSION_HEADER, app


def trace_url(since=0):
    base = f"/trace/events?since={since}"
    return base + (f"&token={main.WEBHOOK_SECRET}" if main.WEBHOOK_SECRET else "")


client = TestClient(app)

WEBHOOK_SECRET = os.environ.get("CARELOOP_WEBHOOK_SECRET", "")


def session_headers(session_id):
    return {SESSION_HEADER: session_id}


def gated_webhook(payload):
    body = dict(payload)
    if WEBHOOK_SECRET:
        body["secret"] = WEBHOOK_SECRET
    return body


def gated(payload=None):
    body = dict(payload or {})
    if WEBHOOK_SECRET:
        body["secret"] = WEBHOOK_SECRET
    return body


CALL_SECRET = os.environ.get("CARELOOP_CALL_TOKEN", "") or WEBHOOK_SECRET


def gated_call(payload=None):
    body = dict(payload or {})
    if CALL_SECRET:
        body["secret"] = CALL_SECRET
    return body


def test_connect_returns_patient_and_derived_schedule():
    body = client.post("/portal/connect", json={"patient_id": "p1"}).json()
    assert body["patient"]["name"] == "Maria Santos"
    assert body["patient"]["connected"] is True

    times = [s["time"] for s in body["derived_schedule"]]
    assert times == ["07:00", "08:00", "08:00", "18:00", "20:00"]


def test_connect_flattens_multiple_medications():
    body = client.post("/portal/connect", json={"patient_id": "p2"}).json()
    assert len(body["patient"]["medication_requests"]) == 5
    assert len(body["derived_schedule"]) == 6


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
    body = client.post("/webhook/elevenlabs", json=gated_webhook({
        "tool_name": "report_symptom",
        "patient_id": "p1",
        "transcript": "I can't breathe",
    })).json()
    assert body["tier"] == "emergency"


def test_webhook_unknown_patient_is_404():
    r = client.post("/webhook/elevenlabs", json=gated_webhook({
        "tool_name": "report_symptom",
        "patient_id": "ghost",
        "transcript": "hi",
    }))
    assert r.status_code == 404


def test_webhook_rejects_unknown_tool():
    r = client.post("/webhook/elevenlabs", json=gated_webhook({"tool_name": "drop_tables", "patient_id": "p1"}))
    assert r.status_code == 400


def test_triage_emits_trace_events_in_order():
    before = client.get(trace_url(0)).json()["events"]
    cursor = before[-1]["seq"] if before else 0
    client.post("/triage", json={"transcript": "my chest is killing me", "patient_id": "p1"})
    new = client.get(trace_url(cursor)).json()["events"]
    types = [e["event_type"] for e in new]
    assert "PATIENT_SPEECH" in types
    assert "TIER_0_CHECK" in types
    assert "TIER_0_MATCH" in types
    assert "EMERGENCY_ESCALATION" in types


def test_trace_events_are_monotonic():
    events = client.get(trace_url(0)).json()["events"]
    seqs = [e["seq"] for e in events]
    assert seqs == sorted(seqs)


def test_health_reports_key_status():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["patients_loaded"] == 2
    assert "gemini_configured" in body


def test_admin_reset_clears_the_trace_and_rotates_boot_id():
    before = client.get(trace_url(0)).json()
    client.post("/triage", json={"transcript": "hello", "patient_id": "p1"})
    body = client.post("/admin/reset", json=gated()).json()
    assert body["reset"] is True
    assert body["boot_id"] != before["boot_id"]
    after = client.get(trace_url(0)).json()
    assert after["events"] == []
    assert after["boot_id"] == body["boot_id"]


def test_trace_events_expose_a_boot_id_for_restart_detection():
    body = client.get(trace_url(0)).json()
    assert isinstance(body["boot_id"], str) and body["boot_id"]


def test_loop_run_offers_first_then_books_once_the_patient_agrees():
    client.post("/admin/reset", json=gated())
    offered = client.post("/loop/run", json={
        "patient_id": "p1",
        "transcript": "I have been throwing up after every dose for three days",
    }).json()
    assert offered["plan"]["next_dose"] is not None
    assert offered["triage"]["tier"] in ("moderate", "severe")
    assert offered["booking"] is None, (
        "the offer and the booking used to happen in one pass, so the agent "
        "asked would that be okay and booked without ever hearing an answer"
    )
    assert offered["booking_offered"] is True

    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "yes that works",
    }).json()
    assert body["booking"]["confirmed"] is True
    assert body["booking"]["simulated_front_desk"] is True
    assert "simulated front desk" in body["booking"]["disclosure"]

    types = [e["event_type"] for e in client.get(trace_url(0)).json()["events"]]
    for expected in ["REMINDER_DUE", "PATIENT_SPEECH", "BOOKING_OFFERED",
                     "CLINIC_CALL_INITIATED", "CLINIC_DESK_SPEECH",
                     "BOOKING_CONFIRMED", "PATIENT_CONFIRMED"]:
        assert expected in types, f"{expected} missing from the loop trace"


def test_loop_never_books_on_an_emergency():
    client.post("/admin/reset", json=gated())
    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "my chest is killing me",
    }).json()
    assert body["triage"]["tier"] == "emergency"
    assert body["booking"] is None
    types = [e["event_type"] for e in client.get(trace_url(0)).json()["events"]]
    assert "CLINIC_CALL_INITIATED" not in types
    assert "EMERGENCY_ESCALATION" in types


def test_loop_never_books_on_a_crisis():
    client.post("/admin/reset", json=gated())
    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "I want to die",
    }).json()
    assert body["triage"]["is_crisis"] is True
    assert body["booking"] is None


def test_schedule_endpoint_returns_a_day_plan():
    body = client.get("/schedule/p1").json()
    assert body["doses_total"] == 5
    assert body["next_call"] is not None


def test_schedule_unknown_patient_is_404():
    assert client.get("/schedule/ghost").status_code == 404


def test_triage_returns_its_own_events_for_stateless_hosts():
    body = client.post("/triage", json={
        "transcript": "my chest is killing me", "patient_id": "p1",
    }).json()
    types = [e["event_type"] for e in body["events"]]
    assert "PATIENT_SPEECH" in types
    assert "TIER_0_MATCH" in types
    assert "EMERGENCY_ESCALATION" in types


def test_loop_returns_its_own_events_for_stateless_hosts():
    headers = session_headers("stateless-events")
    client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "I keep throwing up after every dose",
    }, headers=headers)
    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "yes that works",
    }, headers=headers).json()
    types = [e["event_type"] for e in body["events"]]
    assert "CLINIC_CALL_INITIATED" in types
    assert "CALL_ENDED" in types
    assert body["boot_id"]


def test_returned_events_are_only_this_requests_events():
    client.post("/triage", json={"transcript": "feeling fine", "patient_id": "p1"})
    body = client.post("/triage", json={
        "transcript": "my chest is killing me", "patient_id": "p1",
    }).json()
    texts = [e["payload"].get("text") for e in body["events"] if e["event_type"] == "PATIENT_SPEECH"]
    assert texts == ["my chest is killing me"]


def test_day_plan_uses_clinic_local_time_not_utc():
    import json as _json
    from datetime import datetime, timezone as _tz
    from scheduler import build_day_plan

    patient = _json.load(open("mock_data/patients.json"))["patients"][0]
    judging_morning = datetime(2026, 9, 20, 13, 0, tzinfo=_tz.utc)
    plan = build_day_plan(patient, judging_morning)

    statuses = {d["time"]: d["status"] for d in plan["doses"]}
    assert statuses["08:00"] == "due_now", (
        "At 09:00 local the 08:00 dose must read due_now. Treating the hour as "
        "UTC made it read missed at exactly demo time."
    )
    assert plan["next_dose"]["time"] == "07:00"


def test_adding_a_medication_cascades_snapshot_schedule_and_check():
    client.post("/admin/reset", json=gated())
    before = client.get("/regimen/p1").json()
    assert [f["ingredients"] for f in before["regimen"]["surfaced"]] == [["warfarin", "aspirin"]]

    body = client.post("/meds", json={
        "patient_id": "p1", "medication": "Warfarin 5 mg tablet",
        "dosage_text": "5mg", "frequency": "once daily", "preferred_hours": [20],
    }).json()

    assert body["added"] is True
    assert body["regimen"]["content_hash"] != before["regimen"]["content_hash"]
    assert body["schedule"]["doses_total"] > before["schedule"]["doses_total"]

    types = [e["event_type"] for e in client.get(trace_url(0)).json()["events"]]
    assert "REGIMEN_SNAPSHOT" in types
    assert "SCHEDULE_RECOMPUTED" in types


def test_a_major_interaction_surfaces_with_a_cited_source():
    client.post("/admin/reset", json=gated())
    client.post("/meds", json={
        "patient_id": "p2", "medication": "Warfarin 5 mg tablet", "preferred_hours": [20],
    })
    body = client.post("/meds", json={
        "patient_id": "p2", "medication": "Aspirin 81 mg tablet", "preferred_hours": [8],
    }).json()

    surfaced = body["regimen"]["surfaced"]
    assert surfaced, "warfarin plus aspirin must surface"
    assert surfaced[0]["severity"] == "major"
    assert surfaced[0]["source"]

    types = [e["event_type"] for e in client.get(trace_url(0)).json()["events"]]
    assert "CONTRADICTION_FLAGGED" in types


def test_patient_message_never_tells_anyone_to_stop_a_drug():
    client.post("/admin/reset", json=gated())
    client.post("/meds", json={"patient_id": "p2", "medication": "Warfarin 5 mg tablet"})
    body = client.post("/meds", json={"patient_id": "p2", "medication": "Aspirin 81 mg tablet"}).json()

    message = body["regimen"]["patient_message"].lower()
    assert "do not start, stop or change" in message
    assert "prescriber" in message or "pharmacist" in message

    for forbidden in [
        "stop taking",
        "reduce your dose",
        "lower the dose",
        "half a tablet",
        "keep taking both",
    ]:
        assert forbidden not in message, (
            f"the patient message must not instruct medication use: {forbidden!r}. "
            "Telling someone to keep taking a pair the same message just flagged "
            "as a major interaction is advice, and it is advice in the unsafe "
            "direction."
        )


def test_minor_and_moderate_findings_are_not_surfaced_to_the_patient():
    from contradiction import check_regimen

    meds = [
        {"medication": "Lisinopril 10 mg tablet", "status": "active"},
        {"medication": "Ibuprofen 400 mg tablet", "status": "active"},
    ]
    findings = check_regimen(meds)
    assert findings, "the moderate pair should still be detected"
    assert all(not f["surfaced"] for f in findings), (
        "only major and above reach the patient"
    )


def test_regimen_endpoint_carries_its_own_limitations():
    from contradiction import LIMITATIONS

    body = client.get("/regimen/p1").json()
    assert body["regimen"]["limitations"] == LIMITATIONS
    assert "not a formulary check" in LIMITATIONS.lower()


def test_health_distinguishes_absent_from_present_but_empty(monkeypatch):
    monkeypatch.delenv("TWILIO_FROM_NUMBER", raising=False)
    monkeypatch.setenv("CARELOOP_WEBHOOK_SECRET", "")
    monkeypatch.setenv("GEMINI_MODEL", "some-model")

    env = client.get("/health").json()["env"]
    assert env["TWILIO_FROM_NUMBER"] == "absent"
    assert env["CARELOOP_WEBHOOK_SECRET"] == "present but empty", (
        "A variable that exists with an empty value must not report as absent. "
        "That distinction cost an hour of misdiagnosis in production."
    )
    assert env["GEMINI_MODEL"].startswith("set (")


def test_crisis_episode_is_stored_but_never_returned_by_get_history(tmp_path):
    import json as _json

    from memory import MemoryStore

    store = MemoryStore(tmp_path / "memory_store.json")
    crisis_episode = {
        "call_id": "call_crisis_1",
        "timestamp": "2026-09-19T12:00:00+00:00",
        "transcript": "I want to end my life",
        "tier": "emergency",
        "action_taken": "escalated",
        "summary": "crisis call, action escalated: I want to end my life",
        "is_crisis": True,
    }
    ordinary_episode = {
        "call_id": "call_ordinary_1",
        "timestamp": "2026-09-19T13:00:00+00:00",
        "transcript": "feeling fine today",
        "tier": "mild",
        "action_taken": "logged",
        "summary": "mild call, action logged: feeling fine today",
        "is_crisis": False,
    }
    store.append_episode("px", crisis_episode)
    store.append_episode("px", ordinary_episode)

    history = store.get_history("px")
    assert len(history) == 1
    assert history[0]["call_id"] == "call_ordinary_1"
    assert all(not e.get("is_crisis") for e in history)

    raw = _json.loads((tmp_path / "memory_store.json").read_text())
    assert any(e["is_crisis"] for e in raw["px"]), "the crisis episode must still be on disk"


def test_second_loop_run_surfaces_prior_episode():
    client.post("/admin/reset", json=gated())
    first = client.post("/loop/run", json={
        "patient_id": "p2", "transcript": "feeling fine on the lisinopril",
    }).json()
    assert first["prior_episode"] is None

    second = client.post("/loop/run", json={
        "patient_id": "p2", "transcript": "still feeling fine",
    }).json()
    assert second["prior_episode"] is not None
    assert second["prior_episode"]["transcript"] == "feeling fine on the lisinopril"


def test_a_crisis_episode_from_the_loop_is_never_surfaced_as_a_prior_episode():
    client.post("/admin/reset", json=gated())
    client.post("/loop/run", json={"patient_id": "p1", "transcript": "I want to die"})
    second = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "feeling okay now",
    }).json()
    assert second["prior_episode"] is None


def test_severe_escalation_has_a_thirty_minute_window():
    from datetime import datetime, timedelta, timezone

    from escalation import record_escalation

    fired_at = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)
    record = record_escalation("unit-test-patient", "severe", False, fired_at)

    assert record["kind"] == "severe"
    assert record["would_notify"] == "on call clinician"
    assert record["ack_state"] == "pending"
    deadline = datetime.fromisoformat(record["ack_window_would_expire_at"])
    assert deadline - fired_at == timedelta(minutes=30)


def test_escalation_past_its_window_reports_unacknowledged():
    from datetime import datetime, timedelta, timezone

    from escalation import ack_status, record_escalation, unacknowledged_for_patient

    fired_at = datetime(2026, 9, 19, 8, 0, tzinfo=timezone.utc)
    record = record_escalation("unit-test-patient-2", "severe", False, fired_at)

    just_before = fired_at + timedelta(minutes=29)
    just_after = fired_at + timedelta(minutes=31)

    assert ack_status(record, just_before) == "pending"
    assert ack_status(record, just_after) == "ack_window_elapsed_no_recipient"

    overdue = unacknowledged_for_patient("unit-test-patient-2", just_after)
    assert any(r["escalation_id"] == record["escalation_id"] for r in overdue)

    not_yet_due = unacknowledged_for_patient("unit-test-patient-2", just_before)
    assert not_yet_due == []


def test_cross_call_check_fires_on_stopped_then_claims_taking():
    from contradiction import check_cross_call

    prior_episode = {
        "transcript": "I stopped taking the metformin about a week ago",
        "summary": "moderate call, action logged: I stopped taking the metformin about a week ago",
    }
    findings = check_cross_call("I have been taking it every day", prior_episode)
    assert findings
    assert findings[0]["check_id"] == "cross_call"
    assert findings[0]["surfaced"] is True


def test_cross_call_check_does_not_fire_without_a_contradiction():
    from contradiction import check_cross_call

    assert check_cross_call("I have been taking it every day", None) == []

    consistent_prior = {"transcript": "I have been taking it every day", "summary": ""}
    assert check_cross_call("I have been taking it every day", consistent_prior) == []

    stopped_prior = {"transcript": "I stopped taking it", "summary": ""}
    assert check_cross_call("I feel okay today", stopped_prior) == []


def test_never_contacts_emergency_services_statement_is_in_the_api_response():
    from escalation import NEVER_CONTACTS_EMERGENCY_SERVICES

    client.post("/admin/reset", json=gated())
    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "feeling okay today",
    }).json()
    assert body["safety_statement"] == NEVER_CONTACTS_EMERGENCY_SERVICES
    assert "never contacts emergency services" in body["safety_statement"].lower()

    esc_body = client.get("/escalations/p1").json()
    assert esc_body["safety_statement"] == NEVER_CONTACTS_EMERGENCY_SERVICES


def test_escalations_endpoint_returns_records_for_a_patient():
    client.post("/admin/reset", json=gated())
    client.post("/loop/run", json={
        "patient_id": "p1",
        "transcript": "I have been throwing up after every dose for three days",
    })
    body = client.get("/escalations/p1").json()
    assert body["patient_id"] == "p1"
    assert body["escalations"], "a moderate or severe outcome should have written an escalation"


def test_escalations_endpoint_unknown_patient_is_404():
    assert client.get("/escalations/ghost").status_code == 404


MULTI_WORD_PAIRS = [
    ("Levothyroxine 75 mcg tablet", "Calcium carbonate 500 mg tablet"),
    ("Lisinopril 10 mg tablet", "Potassium chloride 20 mEq tablet"),
    ("Metformin 500 mg tablet", "Contrast media"),
]


@pytest.mark.parametrize("first,second", MULTI_WORD_PAIRS)
def test_multi_word_ingredients_are_matched(first, second):
    """Matching on the first word alone made three rows unreachable.

    "Calcium carbonate" became "calcium" and never matched, so a pair the
    interface itself offers returned a clean bill of health. A false negative
    presented as reassurance is worse than no check.
    """
    from contradiction import check_regimen

    meds = [
        {"medication": first, "status": "active"},
        {"medication": second, "status": "active"},
    ]
    assert check_regimen(meds), f"{first} plus {second} must be detected"


def test_an_unrelated_pair_still_returns_nothing():
    from contradiction import check_regimen

    meds = [
        {"medication": "Metformin 500 mg tablet", "status": "active"},
        {"medication": "Atorvastatin 20 mg tablet", "status": "active"},
    ]
    assert check_regimen(meds) == []


def test_two_sessions_have_independent_patient_lists_after_a_medication_add():
    sess_a = "isolation-session-a"
    sess_b = "isolation-session-b"

    before_b = client.get("/regimen/p1", headers=session_headers(sess_b)).json()
    before_count = len(before_b["medications"])

    client.post("/meds", json={
        "patient_id": "p1", "medication": "Session A Only Medication",
    }, headers=session_headers(sess_a))

    after_a = client.get("/regimen/p1", headers=session_headers(sess_a)).json()
    after_b = client.get("/regimen/p1", headers=session_headers(sess_b)).json()

    assert len(after_a["medications"]) == before_count + 1
    assert len(after_b["medications"]) == before_count
    assert all(m["medication"] != "Session A Only Medication" for m in after_b["medications"])


def test_adding_a_medication_does_not_affect_a_brand_new_session():
    baseline = client.get("/regimen/p2", headers=session_headers("baseline-probe")).json()
    before_count = len(baseline["medications"])

    client.post("/meds", json={
        "patient_id": "p2", "medication": "Session C Only Medication",
    }, headers=session_headers("isolation-session-c"))

    fresh = client.get("/regimen/p2", headers=session_headers("brand-new-session")).json()
    assert len(fresh["medications"]) == before_count
    assert all(m["medication"] != "Session C Only Medication" for m in fresh["medications"])


def test_baseline_fixture_is_never_mutated_by_any_session():
    original = client.get("/regimen/p2", headers=session_headers("probe-original")).json()
    original_count = len(original["medications"])

    for i in range(5):
        client.post("/meds", json={
            "patient_id": "p2", "medication": f"Stress Med {i}",
        }, headers=session_headers(f"stress-session-{i}"))

    brand_new = client.get("/regimen/p2", headers=session_headers("probe-after-stress")).json()
    assert len(brand_new["medications"]) == original_count


def test_trace_events_do_not_cross_sessions():
    sess_x = "trace-session-x"
    sess_y = "trace-session-y"

    baseline_y = client.get(trace_url(0), headers=session_headers(sess_y)).json()
    assert baseline_y["events"] == []

    client.post("/triage", json={
        "transcript": "my chest is killing me", "patient_id": "p1",
    }, headers=session_headers(sess_x))

    events_x = client.get(trace_url(0), headers=session_headers(sess_x)).json()["events"]
    events_y = client.get(trace_url(0), headers=session_headers(sess_y)).json()["events"]

    assert "PATIENT_SPEECH" in [e["event_type"] for e in events_x]
    assert events_y == []


def test_admin_reset_clears_only_the_calling_session():
    sess_p = "reset-session-p"
    sess_q = "reset-session-q"

    client.post("/triage", json={"transcript": "hello", "patient_id": "p1"}, headers=session_headers(sess_p))
    client.post("/triage", json={"transcript": "hello", "patient_id": "p1"}, headers=session_headers(sess_q))

    client.post("/admin/reset", json=gated(), headers=session_headers(sess_p))

    after_p = client.get(trace_url(0), headers=session_headers(sess_p)).json()
    after_q = client.get(trace_url(0), headers=session_headers(sess_q)).json()

    assert after_p["events"] == []
    assert after_q["events"] != []


def test_request_with_no_session_id_still_works():
    health = client.get("/health")
    assert health.status_code == 200

    triage_response = client.post("/triage", json={"transcript": "feeling okay"})
    assert triage_response.status_code == 200
    assert SESSION_HEADER in triage_response.headers
    assert triage_response.headers[SESSION_HEADER]


TELEPHONY_VARS = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "DEMO_PHONE_NUMBER"]


def clear_telephony_env(monkeypatch):
    for name in TELEPHONY_VARS:
        monkeypatch.delenv(name, raising=False)


def set_telephony_env(monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "ACtestsid")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "testtoken")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+15550001111")
    monkeypatch.setenv("DEMO_PHONE_NUMBER", "+15550002222")


def test_call_start_reports_missing_variables_when_not_configured(monkeypatch):
    clear_telephony_env(monkeypatch)
    r = client.post(
        "/call/start", json=gated_call({"patient_id": "p1"}), headers=session_headers("tel-not-configured-1"),
    )
    body = r.json()
    assert body["configured"] is False
    assert set(body["missing_env"]) == set(TELEPHONY_VARS)
    assert body["call_sid"] is None
    for name in TELEPHONY_VARS:
        assert name in body["detail"]


def test_call_clinic_reports_missing_variables_when_not_configured(monkeypatch):
    clear_telephony_env(monkeypatch)
    r = client.post(
        "/call/clinic", json=gated_call({"patient_id": "p1"}), headers=session_headers("tel-not-configured-2"),
    )
    body = r.json()
    assert body["configured"] is False
    assert "TWILIO_ACCOUNT_SID" in body["missing_env"]


def test_call_start_reports_only_the_variables_still_missing(monkeypatch):
    clear_telephony_env(monkeypatch)
    monkeypatch.setenv("DEMO_PHONE_NUMBER", "+15550002222")
    r = client.post(
        "/call/start", json=gated_call({"patient_id": "p1"}), headers=session_headers("tel-partial-1"),
    )
    body = r.json()
    assert body["configured"] is False
    assert "DEMO_PHONE_NUMBER" not in body["missing_env"]
    assert "TWILIO_ACCOUNT_SID" in body["missing_env"]


def test_call_start_refuses_without_the_shared_secret(monkeypatch):
    if not WEBHOOK_SECRET:
        pytest.skip("no shared secret configured for this environment")
    set_telephony_env(monkeypatch)
    r = client.post("/call/start", json={"patient_id": "p1"}, headers=session_headers("tel-no-secret-1"))
    assert r.status_code == 401


def test_call_clinic_refuses_without_the_shared_secret(monkeypatch):
    if not WEBHOOK_SECRET:
        pytest.skip("no shared secret configured for this environment")
    set_telephony_env(monkeypatch)
    r = client.post("/call/clinic", json={"patient_id": "p1"}, headers=session_headers("tel-no-secret-2"))
    assert r.status_code == 401


def test_nothing_dials_when_telephony_is_not_configured(monkeypatch):
    clear_telephony_env(monkeypatch)
    calls = []
    monkeypatch.setattr(telephony, "place_call", lambda *a, **kw: calls.append((a, kw)))

    client.post("/call/start", json=gated_call({"patient_id": "p1"}), headers=session_headers("tel-no-dial-1"))
    client.post("/call/clinic", json=gated_call({"patient_id": "p1"}), headers=session_headers("tel-no-dial-2"))

    assert calls == []


def test_loop_run_does_not_dial_when_telephony_is_not_configured(monkeypatch):
    clear_telephony_env(monkeypatch)
    calls = []
    monkeypatch.setattr(telephony, "place_call", lambda *a, **kw: calls.append((a, kw)))

    headers = session_headers("tel-loop-not-configured-1")
    client.post("/admin/reset", json=gated(), headers=headers)
    client.post("/loop/run", json={
        "patient_id": "p1",
        "transcript": "I have been throwing up after every dose for three days",
        "call_clinic": True,
    }, headers=headers)
    body = client.post("/loop/run", json={
        "patient_id": "p1", "transcript": "yes that works", "call_clinic": True,
    }, headers=headers).json()

    assert body["booking"]["confirmed"] is True
    assert calls == []
    types = [e["event_type"] for e in body["events"]]
    assert "PHONE_CALL_NOT_CONFIGURED" in types


def test_call_start_places_a_call_when_configured(monkeypatch):
    set_telephony_env(monkeypatch)
    calls = []

    def fake_place_call(to, twiml_url=None, twiml=None, status_callback=None, ring_seconds=None):
        calls.append((to, twiml_url))
        return {"ok": True, "call_sid": "CAtest123", "status": "queued"}

    monkeypatch.setattr(telephony, "place_call", fake_place_call)
    headers = session_headers("tel-dial-1")
    r = client.post("/call/start", json=gated_call({"patient_id": "p1"}), headers=headers)
    body = r.json()

    assert body["configured"] is True
    assert body["ok"] is True
    assert body["call_sid"] == "CAtest123"
    assert len(calls) == 1
    assert calls[0][0] == "+15550002222"

    types = [e["event_type"] for e in client.get(trace_url(0), headers=headers).json()["events"]]
    assert "PHONE_CALL_DIALED" in types


def test_call_start_never_dials_an_arbitrary_number(monkeypatch):
    set_telephony_env(monkeypatch)
    calls = []
    monkeypatch.setattr(
        telephony, "place_call",
        lambda to, twiml_url=None, twiml=None, **kw: calls.append(to) or {"ok": True, "call_sid": "CAtest124"},
    )
    r = client.post(
        "/call/start",
        json=gated_call({"patient_id": "p1", "to": "+19995550000"}),
        headers=session_headers("tel-no-arbitrary-1"),
    )
    assert r.status_code == 200
    assert calls == ["+15550002222"]


def test_call_start_is_rate_limited_per_session(monkeypatch):
    set_telephony_env(monkeypatch)
    monkeypatch.setattr(
        telephony, "place_call",
        lambda to, twiml_url=None, twiml=None, **kw: {"ok": True, "call_sid": "CAlimit", "status": "queued"},
    )
    headers = session_headers("tel-rate-limit-1")
    statuses = []
    for _ in range(telephony.PER_MINUTE_LIMIT + 2):
        r = client.post("/call/start", json=gated_call({"patient_id": "p1"}), headers=headers)
        statuses.append(r.status_code)
    assert 429 in statuses


def test_voice_checkin_twiml_identifies_itself_as_automated():
    r = client.get("/voice/checkin?patient_id=p1")
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"]
    root = ET.fromstring(r.text)
    assert root.tag == "Response"
    assert "automated" in r.text.lower()
    assert "Maria" in r.text


def test_voice_clinic_twiml_identifies_itself_and_discloses_the_simulation():
    r = client.get("/voice/clinic")
    assert r.status_code == 200
    ET.fromstring(r.text)
    assert "automated" in r.text.lower()
    assert FRONT_DESK_DISCLOSURE in r.text


def test_voice_checkin_respond_runs_triage_and_speaks_the_response_back():
    r = client.post("/voice/checkin/respond?patient_id=p1", data={"SpeechResult": "I feel fine today"})
    assert r.status_code == 200
    ET.fromstring(r.text)
    assert "<Say" in r.text


def test_voice_checkin_respond_handles_an_empty_transcript_gracefully():
    r = client.post("/voice/checkin/respond?patient_id=p1", data={})
    assert r.status_code == 200
    ET.fromstring(r.text)


def test_one_call_covers_every_medicine_due_in_the_same_window():
    import json as _json
    from datetime import datetime as _dt
    from scheduler import build_day_plan, clinic_timezone

    patient = {p["patient_id"]: p for p in _json.load(open("mock_data/patients.json"))["patients"]}["p2"]
    plan = build_day_plan(patient, _dt.now(clinic_timezone()).replace(hour=11, minute=44))

    morning = plan["calls"][0]
    assert morning["covers"] >= 3, "coalescing needs three medicines in one window to be worth showing"
    assert plan["calls_total"] < plan["doses_total"], "calls must be fewer than doses"


def test_no_call_is_scheduled_outside_the_patients_contact_window():
    import json as _json
    from datetime import datetime as _dt
    from scheduler import build_day_plan, clinic_timezone, contact_window

    for patient in _json.load(open("mock_data/patients.json"))["patients"]:
        window = contact_window(patient)
        plan = build_day_plan(patient, _dt.now(clinic_timezone()).replace(hour=11, minute=44))
        for call in plan["calls"]:
            hour = int(call["time"].split(":")[0])
            assert window["start_hour"] <= hour <= window["end_hour"], (
                f"{patient['patient_id']} would be phoned at {call['time']}, "
                f"outside {window['start']} to {window['end']}"
            )


def test_the_interaction_check_has_something_to_say_about_dorothy():
    import json as _json
    from contradiction import check_regimen

    patient = {p["patient_id"]: p for p in _json.load(open("mock_data/patients.json"))["patients"]}["p2"]
    at_load = check_regimen(patient["medication_requests"])
    assert at_load, "the check must find something, otherwise the screen says nothing conflicts"

    after_portal = check_regimen(patient["medication_requests"] + patient["portal_pending"])
    surfaced = [f for f in after_portal if f["surfaced"]]
    assert any(f["severity"] == "major" for f in surfaced), (
        "the waiting prescription must trip a major finding"
    )


def test_a_later_dose_of_the_same_medicine_is_not_marked_taken():
    from datetime import datetime
    from scheduler import build_day_plan, clinic_timezone

    plan = build_day_plan(
        main.load_patients()["p1"],
        datetime.now(clinic_timezone()).replace(hour=8, minute=0),
    )
    evening = [d for d in plan["doses"] if d["time"] == "20:00"]
    assert evening, "Maria takes metformin twice a day"
    assert evening[0]["status"] != "taken", (
        "the morning dose was taken, not the evening one. Keying the taken set by "
        "medication alone marked a dose twelve hours before it was due."
    )


def test_a_call_group_reports_its_worst_dose_not_its_first():
    from scheduler import coalesce

    groups = coalesce([
        {"due_at": "2026-09-19T07:00:00-04:00", "time": "07:00", "status": "taken",
         "medication": "Levothyroxine", "medication_id": "a"},
        {"due_at": "2026-09-19T08:00:00-04:00", "time": "08:00", "status": "missed",
         "medication": "Metformin", "medication_id": "b"},
        {"due_at": "2026-09-19T08:00:00-04:00", "time": "08:00", "status": "missed",
         "medication": "Aspirin", "medication_id": "c"},
    ])
    assert groups[0]["status"] == "missed", (
        "two of three doses were missed, so the call that covered them is not taken"
    )
