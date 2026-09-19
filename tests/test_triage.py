"""
Tests for the CareLoop two-tier triage engine.

The thesis these tests defend:

    Severity is a property of the SYMPTOM, not of the patient's vocabulary.

So the emergency cases below are deliberately written the way people
actually talk -- clipped, informal, dialectal, apologetic, minimized -- and
every one of them must still land in Tier 0 as an EMERGENCY, with no LLM in
the loop at all.

Tier 1 is exercised with an injected fake classifier so the suite runs
offline and deterministically. No API key required.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage_engine import Severity, detect_emergency, triage  # noqa: E402


# ---------------------------------------------------------------------------
# Fake Tier 1 classifiers (so the suite never touches the network)
# ---------------------------------------------------------------------------

def fake_llm(severity, raw=None):
    """Build a stand-in for classify_with_llm that always returns `severity`."""
    def _classify(transcript):
        return severity, raw if raw is not None else (
            severity.label if severity else "???"
        )
    return _classify


def exploding_llm(transcript):
    """A Tier 1 classifier that must never be called."""
    raise AssertionError(
        "Tier 1 was invoked on a transcript that Tier 0 should have caught."
    )


# ---------------------------------------------------------------------------
# Tier 0: emergencies, worded every which way
# ---------------------------------------------------------------------------

EMERGENCY_TRANSCRIPTS = [
    # chest pain -- clinical, then plain, then regional/informal
    ("I am experiencing severe chest pain radiating to my left arm.", "chest_pain"),
    ("my chest is killing me", "chest_pain"),
    ("There's this heavy pressure on my chest, like something sitting on it.", "chest_pain"),
    ("Feels like a band around my chest, been like that since lunch.", "chest_pain"),

    # breathing
    ("I can't breathe.", "breathing_difficulty"),
    ("cant hardly catch my breath walking to the kitchen", "breathing_difficulty"),
    ("I'm gasping for air over here", "breathing_difficulty"),

    # airway swelling
    ("My throat is swelling shut.", "airway_swelling"),
    ("my tongue feel swollen and my lips puffing up", "airway_swelling"),
    ("throat closing up on me", "airway_swelling"),

    # loss of consciousness
    ("My husband is unconscious and unresponsive.", "loss_of_consciousness"),
    ("I passed out in the bathroom about an hour ago.", "loss_of_consciousness"),
    ("woke up on the floor, don't know how long I was there", "loss_of_consciousness"),

    # severe bleeding
    ("I have severe bleeding that will not stop.", "severe_bleeding"),
    ("it's bleeding real bad and it won't quit", "severe_bleeding"),
    ("I been coughing up blood since this morning", "severe_bleeding"),

    # stroke
    ("One side of my face is drooping and my speech is slurred.", "stroke_signs"),
    ("all of a sudden my left side went numb", "stroke_signs"),
]


@pytest.mark.parametrize("transcript,expected_rule", EMERGENCY_TRANSCRIPTS)
def test_tier0_catches_every_emergency_phrasing(transcript, expected_rule):
    """Every unambiguous emergency must be caught by Tier 0, however it is worded.

    `exploding_llm` is passed in to prove the LLM is never consulted: Tier 0
    returns EMERGENCY before Tier 1 can run, so an LLM can never downgrade it.
    """
    result = triage(transcript, llm_classifier=exploding_llm)

    assert result.severity is Severity.EMERGENCY, (
        f"Tier 0 missed an emergency: {transcript!r}"
    )
    assert result.tier == "tier_0"
    assert expected_rule in result.matched_rules
    assert result.is_emergency


def test_tier0_formal_and_informal_phrasing_agree():
    """The same emergency said two ways gets the same tier. That is the whole point."""
    formal = triage(
        "I am experiencing acute chest pain and shortness of breath.",
        llm_classifier=exploding_llm,
    )
    informal = triage(
        "my chest hurt real bad and I can't hardly breathe",
        llm_classifier=exploding_llm,
    )
    assert formal.severity is informal.severity is Severity.EMERGENCY


def test_detect_emergency_is_usable_standalone():
    """Tier 0 is a pure function -- no LLM, no config, no framework."""
    assert detect_emergency("I can't breathe") == ["breathing_difficulty"]
    assert detect_emergency("Feeling good today, no complaints.") == []
    assert detect_emergency("") == []


# ---------------------------------------------------------------------------
# Tier 1: normal check-ins and non-emergency symptoms
# ---------------------------------------------------------------------------

def test_normal_checkin_stays_mild():
    result = triage(
        "Yep, took the lisinopril this morning with breakfast. Feeling fine.",
        llm_classifier=fake_llm(Severity.MILD),
    )
    assert result.severity is Severity.MILD
    assert result.tier == "tier_1"
    assert result.matched_rules == []
    assert result.escalated is False


def test_mild_side_effect_stays_mild():
    result = triage(
        "A little tired in the afternoons but nothing I can't handle.",
        llm_classifier=fake_llm(Severity.MILD),
    )
    assert result.severity is Severity.MILD


def test_moderate_symptom_worded_plainly():
    result = triage(
        "I have been vomiting after every dose for the past three days.",
        llm_classifier=fake_llm(Severity.MODERATE),
    )
    assert result.severity is Severity.MODERATE
    assert result.escalated is True


def test_same_moderate_symptom_worded_informally():
    """Informal phrasing of an identical symptom must not change the tier."""
    plain = triage(
        "I have been vomiting after every dose for the past three days.",
        llm_classifier=fake_llm(Severity.MODERATE),
    )
    informal = triage(
        "every time I take it I been throwing it right back up, three days now",
        llm_classifier=fake_llm(Severity.MODERATE),
    )
    assert plain.severity is informal.severity is Severity.MODERATE


def test_moderate_symptom_worded_indirectly():
    """Patients minimize. 'Probably nothing' is not a severity signal."""
    result = triage(
        "It's probably nothing, I don't want to be a bother, but the room kind "
        "of tilts on me when I stand up.",
        llm_classifier=fake_llm(Severity.MODERATE),
    )
    assert result.severity is Severity.MODERATE


def test_severe_symptom_escalates_above_floor():
    result = triage(
        "My legs have swollen up so much I can't get my shoes on since yesterday.",
        llm_classifier=fake_llm(Severity.SEVERE),
    )
    assert result.severity is Severity.SEVERE
    assert result.escalated is True


# ---------------------------------------------------------------------------
# The safety property itself
# ---------------------------------------------------------------------------

def test_llm_can_raise_severity():
    """Tier 0 not matching means Tier 1 has its full mild-severe range."""
    for severity in (Severity.MILD, Severity.MODERATE, Severity.SEVERE):
        result = triage("some non-emergency report", llm_classifier=fake_llm(severity))
        assert result.severity is severity


def test_llm_cannot_downgrade_a_tier0_emergency():
    """Even an LLM insisting 'MILD' cannot pull an emergency below EMERGENCY."""
    result = triage("I can't breathe", llm_classifier=fake_llm(Severity.MILD))
    assert result.severity is Severity.EMERGENCY
    assert result.tier == "tier_0"
    assert result.llm_severity is None  # never even asked


def test_llm_failure_holds_at_floor_and_is_visible():
    """An unavailable or unparseable Tier 1 never silently invents a severity."""
    result = triage(
        "I've had a dull headache since I started the new pill.",
        llm_classifier=lambda t: (None, "<<garbage>>"),
    )
    assert result.severity is Severity.MILD
    assert "unavailable or returned an unparseable response" in result.reasoning


def test_result_serializes_for_the_api():
    result = triage("my throat is closing up", llm_classifier=exploding_llm)
    payload = result.to_dict()
    assert payload["severity"] == "EMERGENCY"
    assert payload["tier"] == "tier_0"
    assert payload["is_emergency"] is True
    assert "airway_swelling" in payload["matched_rules"]


# ---------------------------------------------------------------------------
# Crisis handling
# ---------------------------------------------------------------------------

CRISIS_TRANSCRIPTS = [
    "I don't want to be here anymore",
    "I've been thinking about killing myself",
    "honestly I'd be better off dead",
    "I took the whole bottle of pills",
]


@pytest.mark.parametrize("transcript", CRISIS_TRANSCRIPTS)
def test_crisis_is_emergency_but_flagged_separately(transcript):
    """A crisis keeps the EMERGENCY floor but must be routed differently.

    Telling someone who has just disclosed suicidal ideation to call 911 and
    then hanging up is the wrong response. Severity is unchanged; the flag is
    what lets the caller offer 988 and stay on the line instead.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY
    assert result.is_crisis is True


def test_medical_emergency_is_not_flagged_as_crisis():
    """Chest pain is an emergency but not a mental health crisis."""
    result = triage("my chest is killing me", llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY
    assert result.is_crisis is False


def test_crisis_flag_serializes():
    result = triage("I want to kill myself", llm_classifier=exploding_llm)
    assert result.to_dict()["is_crisis"] is True
