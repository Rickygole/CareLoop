"""
CareLoop triage engine.

A two-tier system for classifying what a patient reports during an
automated medication check-in call.

    Tier 0  deterministic regex emergency detection. No network, no LLM,
            no ambiguity. If it matches, we return EMERGENCY immediately.
    Tier 1  an LLM (Gemini) classifies everything Tier 0 did not catch.

The safety property this module exists to guarantee:

    THE LLM CAN ONLY RAISE SEVERITY, NEVER LOWER IT.

Tier 0 establishes a floor. Tier 1 may push the result above that floor
but can never pull it below. When Tier 0 does not match, the floor is the
lowest severity and Tier 1 has its full mild/moderate/severe range.

This module has zero dependency on FastAPI or any web framework. It is a
pure importable unit you can unit test standalone.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Optional


class Severity(IntEnum):
    """Triage tiers, ordered so that a bigger number is more urgent.

    The integer ordering is what makes "never downgrade" a one-line
    guarantee: we take max() of the Tier 0 floor and the Tier 1 result.
    """

    MILD = 1
    MODERATE = 2
    SEVERE = 3
    EMERGENCY = 4

    @property
    def label(self) -> str:
        return self.name


# --------------------------------------------------------------------------
# Tier 0: deterministic emergency detection
# --------------------------------------------------------------------------
#
# Each rule is (name, regex). The regexes are deliberately written to cover
# informal, indirect and dialectal phrasing, because a patient in an actual
# emergency rarely uses clinical vocabulary. "my chest is killing me" and
# "I am experiencing chest pain" must both hit Tier 0.
#
# Design rule for this table: patterns here must be UNAMBIGUOUS emergencies.
# A false positive costs a nurse callback. A false negative costs a patient.

EMERGENCY_RULES: List[tuple] = [
    (
        "chest_pain",
        r"\b(chest|sternum|breastbone)\b[^.!?]{0,40}\b("
        r"pain|hurt\w*|ache\w*|aching|tight\w*|pressure|squeez\w*|crush\w*|"
        r"heavy|heaviness|burning|killing me|on fire|band around"
        r")\b"
        r"|\b(pain|pressure|tightness|tight|weight|band|elephant|vice|vise)\b"
        r"[^.!?]{0,30}\b(in|on|across|around|over)\b[^.!?]{0,15}\bchest\b"
        r"|\bheart attack\b",
    ),
    (
        "breathing_difficulty",
        r"\b(can'?t|cannot|can not|couldn'?t|unable to|hard to|struggl\w* to|"
        r"fight\w* to|gasping (for|to)|not able to)\b[^.!?]{0,25}\b(breath\w*|air|catch my breath)\b"
        r"|\b(short(ness)? of breath|out of breath|winded)\b"
        r"|\bbreath\w*\b[^.!?]{0,20}\b(hard|difficult|labou?red|shallow)\b"
        r"|\bsuffocat\w*|\bchoking\b|\bgasping\b|\bwheezing bad\w*\b",
    ),
    (
        "airway_swelling",
        r"\b(throat|tongue|lips?|face|airway)\b[^.!?]{0,30}\b("
        r"swell\w*|swollen|closing( up)?|clos\w* up|tight\w*|puff\w* up|blocked"
        r")\b"
        r"|\b(swell\w*|swollen|closing)\b[^.!?]{0,20}\b(throat|tongue|airway)\b"
        r"|\banaphyla\w*",
    ),
    (
        "loss_of_consciousness",
        r"\b(unconscious|unresponsive|passed out|blacked out|black\w* out|"
        r"collaps\w*|fainted|not waking up|won'?t wake up|came to on the floor|"
        r"woke up on the (floor|ground)|found (him|her|them|them all) on the (floor|ground)"
        r"|(done )?fell out (on|in|at)|fell out cold)\b",
    ),
    (
        "severe_bleeding",
        r"\b(bleed\w*|blood\w*|h?emorrhag\w*)\b[^.!?]{0,40}\b("
        r"((wo|would|can|could|will|does|ai)\s?n[o']?t|don'?t) (stop|quit|let up|slow down)\w*|"
        r"non.?stop|heavy|heavily|badly|bad|"
        r"a lot|lots|everywhere|soak\w*|pour\w*|gush\w*|profuse\w*"
        r")\b"
        r"|\b((wo|can|will)\s?n[o']?t stop|keeps?)\b[^.!?]{0,20}\bbleed\w*\b"
        r"|\b(coughing|throwing|vomit\w*|spitting)\b[^.!?]{0,15}\bup\b[^.!?]{0,15}\bblood\b"
        r"|\bblood in (my|the) (stool|vomit|urine)\b",
    ),
    (
        "stroke_signs",
        r"\b(face|mouth|smile)\b[^.!?]{0,20}\bdroop\w*"
        r"|\b(slurr\w*|slurring)\b[^.!?]{0,20}\b(speech|words|speaking)\b"
        r"|\b(can'?t|cannot|couldn'?t)\b[^.!?]{0,20}\b(speak|talk|get my words out)\b"
        r"|\b(can'?t|cannot|couldn'?t)\b[^.!?]{0,15}\bmove\b[^.!?]{0,20}"
        r"\b(my |his |her |one |that |the )?(arm|leg|side|face|hand)\b"
        r"|\b(sudden\w*|all of a sudden)\b[^.!?]{0,25}\b(numb\w*|weak\w*|paraly\w*)\b"
        r"|\b(one side|left side|right side|half of my (body|face))\b[^.!?]{0,25}\b(numb|weak|dead|won'?t move)\b"
        r"|\bstroke\b",
    ),
    (
        "cyanosis",
        r"\b(lips?|face|fingers?|skin|nails?)\b[^.!?]{0,25}\b(blue|grey|gray|purple|ashen|dusky)\b"
        r"|\b(blue|grey|gray|ashen|dusky)\b[^.!?]{0,15}\b(lips?|face|skin)\b"
        r"|\b(is|are|looks?|went|gone|turning)\b[^.!?]{0,10}\b(grey|gray|blue|ashen)\b",
    ),
    (
        "unarousable",
        r"\b(can'?t|cannot|couldn'?t|unable to)\b[^.!?]{0,15}\b(stay awake|keep (my )?eyes open)\b"
        r"|\b(can'?t|cannot|couldn'?t)\b[^.!?]{0,20}\b(wake|rouse)\b[^.!?]{0,15}\b(him|her|them|up)\b"
        r"|\b(not|isn'?t|aren'?t)\b[^.!?]{0,15}\b(respond\w*|react\w*)\b",
    ),
    (
        "spanish_emergency",
        r"\bno puedo respirar\b|\bme falta (el )?aire\b"
        r"|\bdolor (en|de) (el )?pecho\b|\bme duele el pecho\b"
        r"|\bse desmay\w*\b|\bno despierta\b|\bno responde\b"
        r"|\bse est[a\u00e1] ahogando\b|\bsangrado\b|\bataque al coraz[o\u00f3]n\b",
    ),
    (
        "seizure",
        r"\b(seizure|seizing|convulsion\w*|fit\w* (and|on the floor)|shaking uncontrollably)\b",
    ),
    (
        "suicidal_ideation",
        r"\b(want\w*\s+to\s+die|wanna\s+die|"
        r"kill\w*\s+(myself|himself|herself|themsel\w+)|"
        r"end\w*\s+(it all|it|my life|his life|her life)|"
        r"tak\w*\s+(my|his|her) own life|"
        r"do(n'?t| not)\s+want\s+to\s+(be here|live|wake up|go on|exist)|"
        r"better off dead|suicid\w*|"
        r"(hurt\w*|harm\w*)\s+(myself|himself|herself))\b",
    ),
    (
        "overdose",
        r"\b(overdose\w*|took (the )?(whole|all of|too many|a whole)\b[^.!?]{0,25}\b(bottle|pills?|tablets?)|"
        r"took (all|the rest of) (my|the) (pills?|meds?|medication))\b",
    ),
]

# Smart punctuation is the difference between EMERGENCY and MILD if we let it
# be. macOS turns a typed apostrophe into U+2019, so "can't breathe" and
# "can’t breathe" are different strings to a regex. Normalize first, always.
_APOSTROPHES = {"\u2019": "'", "\u2018": "'", "\u02bc": "'", "\u00b4": "'", "`": "'"}


def normalize_input(text: str) -> str:
    """Fold the variations a keyboard introduces, before any pattern runs."""
    if not text:
        return ""
    for fancy, plain in _APOSTROPHES.items():
        text = text.replace(fancy, plain)
    return re.sub(r"\s+", " ", text).strip()


# A pattern match is not automatically a finding. "no chest pain today" and
# "I had a seizure back in 2011" contain emergency words but report the
# absence or the history of one. We scope each match against its context.
_NEGATION_BEFORE = re.compile(
    r"\b(no|not|never|none|without|deny|denies|denied|"
    r"do(n'?t| not)|does(n'?t| not)|did(n'?t| not)|have(n'?t| not)|has(n'?t| not)|"
    r"is(n'?t| not)|are(n'?t| not)|was(n'?t| not)|were(n'?t| not)|"
    r"used to|if i|if you|in case|watch for|warn\w*|ask\w* if|told me to|"
    r"call if|supposed to|any sign of|worried about|scared i)\b[^.!?]{0,15}$",
    re.IGNORECASE,
)
_HISTORY_AFTER = re.compile(
    r"^[^.!?]{0,20}\b(last (year|month|week)|years? ago|months? ago|back in \d{4}|"
    r"as a (teen\w*|kid|child)|when i was|none since|never again|not anymore|"
    r"but i'?m fine|but she'?s fine|but he'?s fine)\b",
    re.IGNORECASE,
)

_NEG_WINDOW = 45
_HIST_WINDOW = 30


def _is_scoped_out(text: str, start: int, end: int) -> bool:
    """True when a matched span is negated, hypothetical, or historical."""
    before = text[max(0, start - _NEG_WINDOW):start]
    after = text[end:end + _HIST_WINDOW]
    return bool(_NEGATION_BEFORE.search(before) or _HISTORY_AFTER.search(after))


# Rules that are emergencies but must NOT be answered with "call 911 and hang up".
# A suicide disclosure routed to police and then abandoned is the single most
# criticized failure mode in AI mental health. These still carry the full
# EMERGENCY severity floor; only the recommended RESPONSE differs.
CRISIS_RULES = {"suicidal_ideation", "overdose"}

_COMPILED_EMERGENCY_RULES = [
    (name, re.compile(pattern, re.IGNORECASE)) for name, pattern in EMERGENCY_RULES
]


@dataclass
class TriageResult:
    """The outcome of a triage run, with enough detail to explain itself."""

    severity: Severity
    tier: str                      # "tier_0" or "tier_1"
    reasoning: str
    matched_rules: List[str] = field(default_factory=list)
    llm_severity: Optional[Severity] = None
    llm_raw: Optional[str] = None
    escalated: bool = False        # True when Tier 1 raised above the Tier 0 floor

    @property
    def is_emergency(self) -> bool:
        return self.severity is Severity.EMERGENCY

    @property
    def is_crisis(self) -> bool:
        """True when this is a mental health crisis rather than a medical one.

        Both are EMERGENCY severity. They need different responses: a crisis
        needs a warm handoff to 988 and the caller stays on the line.
        """
        return bool(CRISIS_RULES.intersection(self.matched_rules))

    def to_dict(self) -> dict:
        return {
            "severity": self.severity.label,
            "tier": self.tier,
            "reasoning": self.reasoning,
            "matched_rules": self.matched_rules,
            "llm_severity": self.llm_severity.label if self.llm_severity else None,
            "escalated": self.escalated,
            "is_emergency": self.is_emergency,
            "is_crisis": self.is_crisis,
        }


def detect_emergency(transcript: str) -> List[str]:
    """Tier 0. Return the names of every emergency rule the transcript trips.

    Input is normalized first, then every candidate match is scoped against
    its context so that reporting the absence of a symptom ("no chest pain
    today") or its history ("a seizure back in 2011") does not escalate.

    An empty list means Tier 0 found nothing and Tier 1 should run.
    """
    text = normalize_input(transcript)
    if not text:
        return []

    matched = []
    for name, rx in _COMPILED_EMERGENCY_RULES:
        for m in rx.finditer(text):
            if not _is_scoped_out(text, m.start(), m.end()):
                matched.append(name)
                break
    return matched


# --------------------------------------------------------------------------
# Tier 1: LLM classification
# --------------------------------------------------------------------------

TIER1_PROMPT = """You are a clinical triage classifier for a medication adherence \
check-in call. A patient was asked how they are feeling on their medication. \
Classify the severity of what they reported.

Answer with EXACTLY ONE WORD, one of: MILD, MODERATE, SEVERE

Guidance:
- MILD: no symptoms, routine check-in, or a minor tolerable side effect
  (slight nausea, mild tiredness, a small headache).
- MODERATE: a symptom that is interfering with daily life, worsening, or
  warrants a clinician callback within 24 hours (persistent vomiting,
  dizziness on standing, a rash, swelling in the legs, sleeping badly for days).
- SEVERE: a symptom that needs same-day clinical attention.

Judge the SYMPTOM, not the vocabulary. Patients describe real symptoms in
casual, indirect, or dialectal language. "I been feeling real off, like the
room tilting" is the same finding as "I am experiencing orthostatic dizziness."
Never rate something lower because it was phrased informally, apologetically,
minimized, or in non-standard English.

Patient transcript:
\"\"\"{transcript}\"\"\"

One word:"""

_LLM_WORD_TO_SEVERITY = {
    "MILD": Severity.MILD,
    "MODERATE": Severity.MODERATE,
    "SEVERE": Severity.SEVERE,
}


def _parse_llm_severity(raw: str) -> Optional[Severity]:
    """Pull a severity out of the model's reply. Returns None if unparseable."""
    if not raw:
        return None
    text = raw.strip().upper()
    # Check most-urgent-first so a chatty reply that mentions several words
    # resolves to the highest one mentioned. Fail loud, not quiet.
    for word in ("SEVERE", "MODERATE", "MILD"):
        if re.search(r"\b" + word + r"\b", text):
            return _LLM_WORD_TO_SEVERITY[word]
    return None


def classify_with_llm(transcript: str, model_name: str = "gemini-1.5-flash") -> tuple:
    """Tier 1. Ask Gemini to classify the transcript.

    Returns (Severity or None, raw_text or None). Returns (None, None) on any
    failure -- missing key, network error, unparseable reply. The caller
    decides what to do with that; this function never raises into triage.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None, None

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(
            TIER1_PROMPT.format(transcript=transcript)
        )
        raw = (response.text or "").strip()
        return _parse_llm_severity(raw), raw
    except Exception:
        return None, None


# --------------------------------------------------------------------------
# The public entry point
# --------------------------------------------------------------------------

def triage(transcript: str, llm_classifier=None) -> TriageResult:
    """Run the full two-tier triage on a patient transcript.

    Args:
        transcript: what the patient said, as text.
        llm_classifier: optional callable(transcript) -> (Severity|None, str|None).
            Defaults to Gemini. Injectable so tests can run Tier 1 offline.

    Returns:
        TriageResult. Its severity is never below the Tier 0 floor.
    """
    transcript = (transcript or "").strip()

    # --- Tier 0 -----------------------------------------------------------
    matched = detect_emergency(transcript)
    if matched:
        # Hard stop. We do not spend a network round trip, and more
        # importantly we do not give a language model the opportunity to
        # talk us down from an emergency.
        return TriageResult(
            severity=Severity.EMERGENCY,
            tier="tier_0",
            reasoning=(
                "Tier 0 deterministic rule match: "
                + ", ".join(matched)
                + ". Escalated to EMERGENCY without an LLM call."
            ),
            matched_rules=matched,
        )

    # Tier 0 did not fire, so the floor is the lowest severity and Tier 1
    # has its full mild-to-severe range.
    floor = Severity.MILD

    # When Tier 1 cannot answer we do NOT hold at the floor. An unreachable or
    # rate-limited classifier marking every symptom MILD is a silent failure
    # that fails toward less attention. We fail toward more.
    unavailable_floor = Severity.MODERATE

    # --- Tier 1 -----------------------------------------------------------
    classifier = llm_classifier or classify_with_llm
    llm_severity, llm_raw = classifier(transcript)

    if llm_severity is None:
        # The LLM was unavailable or gave us something we could not parse.
        # We hold at the floor rather than inventing a severity, and we say so.
        return TriageResult(
            severity=unavailable_floor,
            tier="tier_1",
            reasoning=(
                "Tier 0 found no emergency indicators. Tier 1 classifier was "
                "unavailable or returned an unparseable response; failing "
                f"toward attention at {unavailable_floor.label} rather than "
                "assuming the symptom is mild. Flagged for human review."
            ),
            llm_raw=llm_raw,
        )

    # The one line that enforces the safety property.
    final = Severity(max(floor, llm_severity))
    escalated = final > floor

    return TriageResult(
        severity=final,
        tier="tier_1",
        reasoning=(
            f"Tier 0 found no emergency indicators. Tier 1 classified this as "
            f"{llm_severity.label}. Final severity {final.label} "
            f"(Tier 0 floor was {floor.label}; the LLM can raise this floor "
            f"but never lower it)."
        ),
        llm_severity=llm_severity,
        llm_raw=llm_raw,
        escalated=escalated,
    )
