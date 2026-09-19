from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from enum import IntEnum
from typing import List, Optional


DEFAULT_MODEL = "gemini-flash-lite-latest"


class Severity(IntEnum):

    MILD = 1
    MODERATE = 2
    SEVERE = 3
    EMERGENCY = 4

    @property
    def label(self) -> str:
        return self.name


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


_APOSTROPHES = {"\u2019": "'", "\u2018": "'", "\u02bc": "'", "\u00b4": "'", "`": "'"}


def normalize_input(text: str) -> str:
    if not text:
        return ""
    for fancy, plain in _APOSTROPHES.items():
        text = text.replace(fancy, plain)
    return re.sub(r"\s+", " ", text).strip()


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
    before = text[max(0, start - _NEG_WINDOW) : start]
    after = text[end : end + _HIST_WINDOW]
    return bool(_NEGATION_BEFORE.search(before) or _HISTORY_AFTER.search(after))


CRISIS_RULES = {"suicidal_ideation", "overdose"}

_COMPILED_EMERGENCY_RULES = [
    (name, re.compile(pattern, re.IGNORECASE)) for name, pattern in EMERGENCY_RULES
]


@dataclass
class TriageResult:

    severity: Severity
    tier: str
    reasoning: str
    matched_rules: List[str] = field(default_factory=list)
    llm_severity: Optional[Severity] = None
    llm_raw: Optional[str] = None
    normalized_text: Optional[str] = None
    confidence: Optional[float] = None
    escalated: bool = False

    @property
    def is_emergency(self) -> bool:
        return self.severity is Severity.EMERGENCY

    @property
    def is_crisis(self) -> bool:
        return bool(CRISIS_RULES.intersection(self.matched_rules))

    def to_dict(self) -> dict:
        return {
            "severity": self.severity.label,
            "tier": self.tier,
            "reasoning": self.reasoning,
            "matched_rules": self.matched_rules,
            "llm_severity": self.llm_severity.label if self.llm_severity else None,
            "normalized_text": self.normalized_text,
            "confidence": self.confidence,
            "escalated": self.escalated,
            "is_emergency": self.is_emergency,
            "is_crisis": self.is_crisis,
        }


def detect_emergency(transcript: str) -> List[str]:
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


TIER1_PROMPT = """You are a clinical triage classifier for a medication \
adherence check-in call. A patient was asked how they are feeling on their \
medication.

Work in two steps, in this order:

1. normalized_text: restate what the patient said in standard, neutral
   clinical phrasing. Preserve every symptom detail they mentioned. Do not
   add symptoms they did not mention. Do not soften or escalate severity.
2. tier: classify the severity of the restated description as exactly one
   of mild, moderate, or severe.

   mild: no symptoms, a routine check-in, or a minor tolerable side effect.
   moderate: a symptom interfering with daily life, worsening, or warranting
     a clinician callback within 24 hours.
   severe: a symptom needing same-day clinical attention.

Do not use an emergency classification. True emergencies are filtered out
deterministically before they reach you.

Judge the SYMPTOM, not the vocabulary. Patients describe real symptoms in
casual, indirect, hedged, or non-standard English, and in languages other
than English. "I been feeling real off, like the room tilting" reports the
same finding as "I am experiencing orthostatic dizziness". Never rate
something lower because of how it was phrased.

Patient transcript:
\"\"\"{transcript}\"\"\"

Respond with only this JSON object, no other text:
{{"normalized_text": "...", "tier": "mild|moderate|severe", "confidence": 0.0, "reasoning": "one sentence"}}"""

_LLM_WORD_TO_SEVERITY = {
    "MILD": Severity.MILD,
    "MODERATE": Severity.MODERATE,
    "SEVERE": Severity.SEVERE,
}


LLM_TIMEOUT_SECONDS = 2.5
LLM_MAX_OUTPUT_TOKENS = 1024


@dataclass
class LLMVerdict:

    severity: Optional[Severity]
    raw: Optional[str] = None
    normalized_text: Optional[str] = None
    confidence: Optional[float] = None
    reasoning: Optional[str] = None


def _parse_llm_severity(raw: str) -> Optional[Severity]:
    if not raw:
        return None
    text = raw.strip().upper()

    for word in ("SEVERE", "MODERATE", "MILD"):
        if re.search(r"\b" + word + r"\b", text):
            return _LLM_WORD_TO_SEVERITY[word]
    return None


def _parse_llm_response(raw: str) -> LLMVerdict:
    if not raw:
        return LLMVerdict(severity=None)

    text = raw.strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group(0))
            severity = _LLM_WORD_TO_SEVERITY.get(str(data.get("tier", "")).upper())
            confidence = data.get("confidence")
            return LLMVerdict(
                severity=severity or _parse_llm_severity(text),
                raw=text,
                normalized_text=data.get("normalized_text"),
                confidence=float(confidence) if isinstance(confidence, (int, float)) else None,
                reasoning=data.get("reasoning"),
            )
        except (ValueError, TypeError):
            pass

    return LLMVerdict(severity=_parse_llm_severity(text), raw=text)


def _gemini_rest_call(model_name: str, api_key: str, prompt: str) -> str:
    import json as _json
    import urllib.request

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model_name}:generateContent?key={api_key}"
    )
    body = _json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": LLM_MAX_OUTPUT_TOKENS,
            "responseMimeType": "application/json",
        },
    }).encode("utf-8")

    request = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(request, timeout=LLM_TIMEOUT_SECONDS) as response:
        data = _json.loads(response.read().decode("utf-8"))

    for candidate in data.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            if part.get("text"):
                return part["text"]
    return ""


def classify_with_llm(transcript: str, model_name: str = None) -> LLMVerdict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return LLMVerdict(severity=None)

    model_name = model_name or os.environ.get("GEMINI_MODEL") or DEFAULT_MODEL

    try:
        raw = _gemini_rest_call(
            model_name, api_key, TIER1_PROMPT.format(transcript=transcript)
        )
        return _parse_llm_response(raw.strip())
    except Exception:
        return LLMVerdict(severity=None)


def _coerce_verdict(value) -> LLMVerdict:
    if isinstance(value, LLMVerdict):
        return value
    if isinstance(value, tuple):
        severity = value[0] if len(value) > 0 else None
        raw = value[1] if len(value) > 1 else None
        return LLMVerdict(severity=severity, raw=raw)
    return LLMVerdict(severity=None)


def triage(transcript: str, llm_classifier=None) -> TriageResult:
    transcript = (transcript or "").strip()

    matched = detect_emergency(transcript)
    if matched:

        return TriageResult(
            severity=Severity.EMERGENCY,
            tier="tier_0",
            reasoning=(
                "Tier 0 deterministic rule match: "
                + ", ".join(matched)
                + ". Escalated to EMERGENCY without an LLM call."
            ),
            matched_rules=matched,
            confidence=1.0,
        )

    floor = Severity.MILD

    unavailable_floor = Severity.MODERATE

    classifier = llm_classifier or classify_with_llm
    verdict = _coerce_verdict(classifier(transcript))
    llm_severity, llm_raw = verdict.severity, verdict.raw

    if llm_severity is None:

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
            normalized_text=verdict.normalized_text,
        )

    final = Severity(max(floor, llm_severity))
    escalated = final > floor

    return TriageResult(
        severity=final,
        tier="tier_1",
        reasoning=(
            f"Tier 0 found no emergency indicators. Tier 1 classified this as "
            f"{llm_severity.label}. "
            + (f"Normalized as: {verdict.normalized_text!r}. " if verdict.normalized_text else "")
            + (f"{verdict.reasoning} " if verdict.reasoning else "")
            + f"Final severity {final.label} "
            f"(Tier 0 floor was {floor.label}; the LLM can raise this floor "
            f"but never lower it)."
        ),
        llm_severity=llm_severity,
        llm_raw=llm_raw,
        escalated=escalated,
        normalized_text=verdict.normalized_text,
        confidence=verdict.confidence,
    )
