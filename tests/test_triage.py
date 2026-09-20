import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage_engine import Severity, detect_emergency, triage


def fake_llm(severity, raw=None):
    def _classify(transcript):
        return severity, raw if raw is not None else (severity.label if severity else "???")

    return _classify


def exploding_llm(transcript):
    raise AssertionError("Tier 1 was invoked on a transcript that Tier 0 should have caught.")


EMERGENCY_TRANSCRIPTS = [
    ("I am experiencing severe chest pain radiating to my left arm.", "chest_pain"),
    ("my chest is killing me", "chest_pain"),
    ("There's this heavy pressure on my chest, like something sitting on it.", "chest_pain"),
    ("Feels like a band around my chest, been like that since lunch.", "chest_pain"),
    ("I can't breathe.", "breathing_difficulty"),
    ("cant hardly catch my breath walking to the kitchen", "breathing_difficulty"),
    ("I'm gasping for air over here", "breathing_difficulty"),
    ("My throat is swelling shut.", "airway_swelling"),
    ("my tongue feel swollen and my lips puffing up", "airway_swelling"),
    ("throat closing up on me", "airway_swelling"),
    ("My husband is unconscious and unresponsive.", "loss_of_consciousness"),
    ("I passed out in the bathroom about an hour ago.", "loss_of_consciousness"),
    ("woke up on the floor, don't know how long I was there", "loss_of_consciousness"),
    ("I have severe bleeding that will not stop.", "severe_bleeding"),
    ("it's bleeding real bad and it won't quit", "severe_bleeding"),
    ("won't quit bleeding", "severe_bleeding"),
    ("I been coughing up blood since this morning", "severe_bleeding"),
    ("One side of my face is drooping and my speech is slurred.", "stroke_signs"),
    ("all of a sudden my left side went numb", "stroke_signs"),
    ("He's clutching his chest and sweating through his shirt.", "chest_pain"),
    ("crushing pressure in the middle of my chest", "chest_pain"),
    ("chets pain realy bad", "chest_pain"),
    ("i think im having a heart atack", "chest_pain"),
    ("She stopped breathing for a second there.", "breathing_difficulty"),
    ("having trubble breathing since this morning", "breathing_difficulty"),
    ("I cannot lie flat without feeling short of breath", "breathing_difficulty"),
    ("My husband just went down in the kitchen and he ain't moving.", "loss_of_consciousness"),
    ("Mom is on the floor and she won't get up.", "loss_of_consciousness"),
]


@pytest.mark.parametrize("transcript,expected_rule", EMERGENCY_TRANSCRIPTS)
def test_tier0_catches_every_emergency_phrasing(transcript, expected_rule):
    result = triage(transcript, llm_classifier=exploding_llm)

    assert result.severity is Severity.EMERGENCY, f"Tier 0 missed an emergency: {transcript!r}"
    assert result.tier == "tier_0"
    assert expected_rule in result.matched_rules
    assert result.is_emergency


def test_tier0_formal_and_informal_phrasing_agree():
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
    assert detect_emergency("I can't breathe") == ["breathing_difficulty"]
    assert detect_emergency("Feeling good today, no complaints.") == []
    assert detect_emergency("") == []


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


def test_llm_can_raise_severity():
    for severity in (Severity.MILD, Severity.MODERATE, Severity.SEVERE):
        result = triage("some non-emergency report", llm_classifier=fake_llm(severity))
        assert result.severity is severity


def test_llm_cannot_downgrade_a_tier0_emergency():
    result = triage("I can't breathe", llm_classifier=fake_llm(Severity.MILD))
    assert result.severity is Severity.EMERGENCY
    assert result.tier == "tier_0"
    assert result.llm_severity is None


def test_llm_failure_fails_toward_attention():
    result = triage(
        "I've had a dull headache since I started the new pill.",
        llm_classifier=lambda t: (None, "<<garbage>>"),
    )
    assert (
        result.severity is Severity.MODERATE
    ), "An unreachable classifier must fail toward attention, not toward mild."
    assert "failing toward attention" in result.reasoning


def test_result_serializes_for_the_api():
    result = triage("my throat is closing up", llm_classifier=exploding_llm)
    payload = result.to_dict()
    assert payload["severity"] == "EMERGENCY"
    assert payload["tier"] == "tier_0"
    assert payload["is_emergency"] is True
    assert "airway_swelling" in payload["matched_rules"]


CRISIS_TRANSCRIPTS = [
    "I don't want to be here anymore",
    "I've been thinking about killing myself",
    "honestly I'd be better off dead",
    "I took the whole bottle of pills",
]


@pytest.mark.parametrize("transcript", CRISIS_TRANSCRIPTS)
def test_crisis_is_emergency_but_flagged_separately(transcript):
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY
    assert result.is_crisis is True


def test_medical_emergency_is_not_flagged_as_crisis():
    result = triage("my chest is killing me", llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY
    assert result.is_crisis is False


def test_crisis_flag_serializes():
    result = triage("I want to kill myself", llm_classifier=exploding_llm)
    assert result.to_dict()["is_crisis"] is True


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


@pytest.mark.parametrize(
    "transcript",
    [
        "I can\u2019t breathe",
        "he won\u2019t wake up",
        "I can\u2018t move one side of it",
        "I  can't    breathe",
        "  I can't breathe  ",
    ],
)
def test_typographic_variants_still_reach_tier0(transcript):
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY


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
    "My father died of a heart attack in 1998.",
]


CHRONIC_BREATHING_NON_EMERGENCIES = [
    "I get a bit winded going up the stairs, but that has been true for years",
    "short of breath walking to the mailbox",
]


@pytest.mark.parametrize("transcript", CHRONIC_BREATHING_NON_EMERGENCIES)
def test_chronic_exertional_breathlessness_does_not_escalate(transcript):
    assert (
        detect_emergency(transcript) == []
    ), f"chronic baseline breathlessness read as an emergency: {transcript!r}"


@pytest.mark.parametrize("transcript", NON_ESCALATING)
def test_negated_and_historical_mentions_do_not_escalate(transcript):
    assert (
        detect_emergency(transcript) == []
    ), f"False positive on a negated or historical mention: {transcript!r}"


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
    "Me duele mucho el pecho desde anoche.",
    "Tengo un dolor fuerte en el pecho.",
    "Me cuesta respirar.",
    "Estoy sangrando mucho.",
    "Creo que estoy teniendo un infarto.",
    "Mi mama no se despierta.",
]


@pytest.mark.parametrize("transcript", NATURAL_EMERGENCIES)
def test_natural_and_non_english_phrasing_reaches_tier0(transcript):
    result = triage(transcript, llm_classifier=exploding_llm)
    assert (
        result.severity is Severity.EMERGENCY
    ), f"Missed a natural-phrasing emergency: {transcript!r}"


from triage_engine import LLMVerdict, _parse_llm_response


def test_parses_structured_json_response():
    raw = (
        '{"normalized_text": "patient reports gastrointestinal discomfort", '
        '"tier": "moderate", "confidence": 0.82, "reasoning": "Persistent GI symptoms."}'
    )
    v = _parse_llm_response(raw)
    assert v.severity is Severity.MODERATE
    assert v.normalized_text == "patient reports gastrointestinal discomfort"
    assert v.confidence == 0.82


def test_parses_json_wrapped_in_prose():
    raw = 'Here you go:\n```json\n{"normalized_text": "x", "tier": "severe"}\n```'
    assert _parse_llm_response(raw).severity is Severity.SEVERE


def test_falls_back_to_word_scan_when_json_is_broken():
    v = _parse_llm_response('{"tier": "moderate", broken json here')
    assert v.severity is Severity.MODERATE


def test_unparseable_response_yields_no_severity():
    assert _parse_llm_response("I cannot help with that").severity is None
    assert _parse_llm_response("").severity is None


def test_chatty_reply_resolves_to_the_most_urgent_word():
    raw = "This is not mild, and not quite moderate, it is severe."
    assert _parse_llm_response(raw).severity is Severity.SEVERE


def test_rich_verdict_populates_normalized_text_and_confidence():
    verdict = LLMVerdict(
        severity=Severity.MODERATE,
        raw="{}",
        normalized_text="patient reports nausea",
        confidence=0.77,
    )
    result = triage("stomach's off", llm_classifier=lambda t: verdict)
    assert result.normalized_text == "patient reports nausea"
    assert result.confidence == 0.77


def test_legacy_tuple_classifier_still_supported():
    result = triage("feeling fine", llm_classifier=lambda t: (Severity.MILD, "MILD"))
    assert result.severity is Severity.MILD


def test_tier0_match_reports_full_confidence():
    result = triage("I can't breathe", llm_classifier=exploding_llm)
    assert result.confidence == 1.0


HEDGED_CRISIS = [
    "I'm not gonna lie, I want to die.",
    "Never mind, I took the whole bottle of pills.",
    "I'm tired of living.",
    "I have been thinking about ending things.",
    "Life ain't worth living no more.",
]


@pytest.mark.parametrize("transcript", HEDGED_CRISIS)
def test_a_negation_earlier_in_the_sentence_cannot_silence_a_crisis(transcript):
    """A hedge before a disclosure must not suppress it.

    The negation guard scanned 45 characters backward, so any earlier "not",
    "never" or "don't" silenced the suicide rule entirely: no crisis flag, no
    988, and the routine moderate response was served instead. A hedge is how
    people actually raise this.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY, f"crisis silenced: {transcript!r}"
    assert result.is_crisis is True


DIRECT_CRISIS_DENIAL = [
    "I'm not suicidal, just a bit blue about the weather",
    "I am not suicidal",
]


@pytest.mark.parametrize("transcript", DIRECT_CRISIS_DENIAL)
def test_a_direct_denial_adjacent_to_the_phrase_is_still_suppressed(transcript):
    """Denying it outright must still be heard as a denial.

    The window is tight rather than absent: a negation immediately against the
    phrase suppresses, one further back does not.
    """
    assert detect_emergency(transcript) == []


HEDGED_EMERGENCY = [
    "I'm scared I'm having a heart attack right now.",
    "I'm scared I can't breathe.",
    "I'm worried about my chest pain, it's really bad right now.",
]


@pytest.mark.parametrize("transcript", HEDGED_EMERGENCY)
def test_fear_is_not_a_hypothetical(transcript):
    """"I'm scared I'm having a heart attack" is a report, not a hypothetical.

    Two cues meant to catch hypotheticals were instead catching the most
    common way a frightened patient opens a sentence.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY, f"suppressed a real emergency: {transcript!r}"


HEDGED_NON_CRISIS_EMERGENCY = [
    "I don't know, my chest is really crushing",
    "I dont know, I cant breathe",
    "not gonna lie, my face is drooping",
    "no joke, Im bleeding heavily",
    "Im not sure but I passed out",
    "never mind that, my chest is crushing",
]


@pytest.mark.parametrize("transcript", HEDGED_NON_CRISIS_EMERGENCY)
def test_a_hedge_before_a_non_crisis_emergency_cannot_silence_it(transcript):
    """The same hedge-silences-a-disclosure bug that was fixed for crisis
    rules also applied to every other emergency rule, and unlike crisis it had
    never been fixed there. The negation guard's proximity gap crossed comma
    and "but" clause boundaries, so "I don't know, my chest is really
    crushing" read the "don't" from an unrelated clause as negating the chest
    pain three words later and downgraded a heart attack to a routine
    follow-up offer.
    """
    result = triage(transcript, llm_classifier=exploding_llm)
    assert result.severity is Severity.EMERGENCY, f"emergency silenced by a hedge: {transcript!r}"
