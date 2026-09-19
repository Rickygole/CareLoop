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


def test_llm_failure_fails_toward_attention():
    """An unavailable Tier 1 escalates to MODERATE rather than assuming mild.

    A dead API key or a rate limit must not quietly mark every symptom MILD.
    """
    result = triage(
        "I've had a dull headache since I started the new pill.",
        llm_classifier=lambda t: (None, "<<garbage>>"),
    )
    assert result.severity is Severity.MODERATE, (
        "An unreachable classifier must fail toward attention, not toward mild."
    )
    assert "failing toward attention" in result.reasoning


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


# ---------------------------------------------------------------------------
# Spec conformance: the transcripts the product spec itself mandates
#
# These are copied verbatim from the plan's B.5 test set. The rest of this
# file tests strings chosen to match the patterns, which proves the patterns
# match themselves. These prove the patterns match the SPEC.
# ---------------------------------------------------------------------------

SPEC_MANDATED_EMERGENCIES = [
    "I can't breathe, my chest feels really tight",
    "help, I think I'm having a heart attack",
    "my throat feels like it's closing up",
    "he just passed out, he won't wake up",
    "there's blood everywhere, it won't stop",
    "my face feels weird, I can't move one side of it",
]


@pytest.mark.parametrize("transcript", SPEC_MANDATED_EMERGENCIES)
def test_spec_mandated_emergencies_all_hit_tier0(transcript):
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY
    assert result.tier == "tier_0"


SPEC_MANDATED_NON_EMERGENCIES = [
    "my stomach hurts a little",
    "I have a slight headache",
    "a bit dizzy when I stood up too fast",
]


@pytest.mark.parametrize("transcript", SPEC_MANDATED_NON_EMERGENCIES)
def test_spec_false_positive_guards_do_not_fire(transcript):
    assert detect_emergency(transcript) == []


# ---------------------------------------------------------------------------
# Input normalization
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("transcript", [
    "I can’t breathe",            # macOS smart apostrophe
    "he won’t wake up",
    "I can‘t move one side of it",
    "I  can't    breathe",             # collapsed whitespace
    "  I can't breathe  ",
])
def test_typographic_variants_still_reach_tier0(transcript):
    """A smart quote must not be the difference between 911 and 'log it'.

    macOS converts a typed apostrophe to U+2019 by default, so this is what
    a judge typing into the console actually produces.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY


# ---------------------------------------------------------------------------
# Negation, hypotheticals, and history must not escalate
# ---------------------------------------------------------------------------

NON_ESCALATING = [
    "no chest pain today",
    "I don't have any chest pain",
    "I used to get chest pain but not anymore",
    "I'm not suicidal, just a bit blue about the weather",
    "my sister had a heart attack last year, but I'm fine",
    "the doctor asked if I had chest pain",
    "I had a seizure back in 2011, none since",
    "the leaflet says to watch for throat swelling",
    "if I ever can't breathe I'll call 911, but I'm good",
    "I passed out once as a teenager, never again",
]


@pytest.mark.parametrize("transcript", NON_ESCALATING)
def test_negated_and_historical_mentions_do_not_escalate(transcript):
    """Reporting the absence or history of a symptom is not an emergency.

    'no chest pain today' is one of the most common sentences in primary
    care. Escalating it to 911 would make Tier 0 unusable.
    """
    assert detect_emergency(transcript) == [], (
        f"False positive on a negated or historical mention: {transcript!r}"
    )


# ---------------------------------------------------------------------------
# Natural, dialectal, third-party, and Spanish phrasing
# ---------------------------------------------------------------------------

NATURAL_EMERGENCIES = [
    "my husband is grey and he's not responding to me",
    "my mother's lips have gone blue",
    "he done fell out on the kitchen floor",
    "I been bleedin and it ain't stoppin",
    "I want to die",
    "I can't stay awake",
    "I can't wake him up",
    "tengo dolor en el pecho y me falta el aire",
    "no puedo respirar",
    "mi esposo se desmayo",
]


@pytest.mark.parametrize("transcript", NATURAL_EMERGENCIES)
def test_natural_and_non_english_phrasing_reaches_tier0(transcript):
    """Severity is a property of the symptom, not of the dialect or language.

    A Tier 0 layer that only understands standard clinical English is a
    Tier 0 layer that fails the patients most likely to be under-triaged.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY, (
        f"Missed a natural-phrasing emergency: {transcript!r}"
    )


# ---------------------------------------------------------------------------
# Tier 1 response parsing
# ---------------------------------------------------------------------------

from triage_engine import LLMVerdict, _parse_llm_response  # noqa: E402


def test_parses_structured_json_response():
    raw = ('{"normalized_text": "patient reports gastrointestinal discomfort", '
           '"tier": "moderate", "confidence": 0.82, "reasoning": "Persistent GI symptoms."}')
    v = _parse_llm_response(raw)
    assert v.severity is Severity.MODERATE
    assert v.normalized_text == "patient reports gastrointestinal discomfort"
    assert v.confidence == 0.82


def test_parses_json_wrapped_in_prose():
    """Models sometimes wrap JSON in a code fence or a sentence."""
    raw = 'Here you go:\n```json\n{"normalized_text": "x", "tier": "severe"}\n```'
    assert _parse_llm_response(raw).severity is Severity.SEVERE


def test_falls_back_to_word_scan_when_json_is_broken():
    v = _parse_llm_response('{"tier": "moderate", broken json here')
    assert v.severity is Severity.MODERATE


def test_unparseable_response_yields_no_severity():
    assert _parse_llm_response("I cannot help with that").severity is None
    assert _parse_llm_response("").severity is None


def test_chatty_reply_resolves_to_the_most_urgent_word():
    """A reply mentioning several tiers must not resolve downward."""
    raw = "This is not mild, and not quite moderate, it is severe."
    assert _parse_llm_response(raw).severity is Severity.SEVERE


def test_rich_verdict_populates_normalized_text_and_confidence():
    verdict = LLMVerdict(
        severity=Severity.MODERATE, raw="{}",
        normalized_text="patient reports nausea", confidence=0.77,
    )
    result = triage("stomach's off", llm_classifier=lambda t: verdict)
    assert result.normalized_text == "patient reports nausea"
    assert result.confidence == 0.77


def test_legacy_tuple_classifier_still_supported():
    """The old two-tuple contract keeps working, so existing tests stay valid."""
    result = triage("feeling fine", llm_classifier=lambda t: (Severity.MILD, "MILD"))
    assert result.severity is Severity.MILD


def test_tier0_match_reports_full_confidence():
    result = triage("I can't breathe", llm_classifier=exploding_llm)
    assert result.confidence == 1.0
