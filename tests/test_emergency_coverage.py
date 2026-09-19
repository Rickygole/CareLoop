import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from triage_engine import detect_emergency


THIRD_PARTY_REPORTS = [
    "My husband just went down in the kitchen and he ain't moving.",
    "Mom is on the floor and she won't get up.",
    "He's clutching his chest and sweating through his shirt.",
    "She stopped breathing for a second there.",
    "my husband is grey and he's not responding to me",
]

TYPOS = [
    "chets pain realy bad",
    "having trubble breathing since this morning",
    "i think im having a heart atack",
]

SPANISH = [
    "Me duele mucho el pecho desde anoche.",
    "Tengo un dolor fuerte en el pecho.",
    "Me cuesta respirar.",
    "Estoy sangrando mucho.",
    "Creo que estoy teniendo un infarto.",
    "Mi mama no se despierta.",
]

STRUCTURAL_DEFECTS = [
    "crushing pressure in the middle of my chest",
    "won't quit bleeding",
    "I cannot lie flat without feeling short of breath",
]

MISS_CORPUS = THIRD_PARTY_REPORTS + TYPOS + SPANISH + STRUCTURAL_DEFECTS


@pytest.mark.parametrize("transcript", MISS_CORPUS)
def test_previously_missed_emergency_is_now_caught(transcript):
    assert detect_emergency(transcript), f"still missed: {transcript!r}"


FALSE_POSITIVE_GUARDS = [
    "no chest pain today",
    "I don't have any chest pain",
    "I used to get chest pain but not anymore",
    "the doctor asked if I had chest pain",
    "I had a seizure back in 2011, none since",
    "the leaflet says to watch for throat swelling",
    "if I ever can't breathe I'll call 911, but I'm good",
    "I passed out once as a teenager, never again",
    "my stomach hurts a little",
    "I have a slight headache",
    "a bit dizzy when I stood up too fast",
    "I'm not suicidal, just a bit blue about the weather",
    "my sister had a heart attack last year, but I'm fine",
    "My father died of a heart attack in 1998.",
]

CHRONIC_BREATHING_GUARDS = [
    "I get a bit winded going up the stairs, but that has been true for years",
    "short of breath walking to the mailbox",
]

GUARD_CORPUS = FALSE_POSITIVE_GUARDS + CHRONIC_BREATHING_GUARDS


@pytest.mark.parametrize("transcript", GUARD_CORPUS)
def test_false_positive_guard_still_holds(transcript):
    assert detect_emergency(transcript) == [], f"new false positive: {transcript!r}"


def test_crisis_keeps_its_tighter_negation_window():
    hedge = detect_emergency("I'm not gonna lie, I want to die")
    denial = detect_emergency("I'm not suicidal")
    assert hedge == ["suicidal_ideation"], f"a hedge silenced a crisis: {hedge!r}"
    assert denial == [], f"a direct denial should still be suppressed: {denial!r}"


def test_measured_catch_rate_on_the_miss_corpus():
    caught = sum(1 for t in MISS_CORPUS if detect_emergency(t))
    rate = caught / len(MISS_CORPUS)
    print(f"Tier 0 catch rate on the miss corpus: {caught}/{len(MISS_CORPUS)} ({rate:.1%})")
    assert rate == 1.0, f"Tier 0 only caught {caught}/{len(MISS_CORPUS)} of the miss corpus"


def test_measured_false_positive_rate_on_the_guard_corpus():
    fired = sum(1 for t in GUARD_CORPUS if detect_emergency(t))
    rate = fired / len(GUARD_CORPUS)
    print(f"Tier 0 false positive rate on the guard corpus: {fired}/{len(GUARD_CORPUS)} ({rate:.1%})")
    assert fired == 0, f"Tier 0 fired on {fired}/{len(GUARD_CORPUS)} guard cases that must stay silent"
