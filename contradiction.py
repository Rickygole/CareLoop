import re
from typing import Dict, List, Optional

SURFACE_THRESHOLD = "major"
SEVERITY_ORDER = {"minor": 1, "moderate": 2, "major": 3, "contraindicated": 4}

INTERACTION_PAIRS = [
    {"a": "warfarin", "b": "aspirin", "severity": "major",
     "concern": "additive bleeding risk",
     "source": "FDA label, Coumadin, Drug Interactions"},
    {"a": "warfarin", "b": "ibuprofen", "severity": "major",
     "concern": "additive bleeding risk and GI injury",
     "source": "FDA label, Coumadin, Drug Interactions"},
    {"a": "warfarin", "b": "naproxen", "severity": "major",
     "concern": "additive bleeding risk and GI injury",
     "source": "FDA label, Coumadin, Drug Interactions"},
    {"a": "warfarin", "b": "fluconazole", "severity": "major",
     "concern": "CYP2C9 inhibition raising INR",
     "source": "FDA label, Diflucan, Drug Interactions"},
    {"a": "lisinopril", "b": "spironolactone", "severity": "major",
     "concern": "additive hyperkalemia",
     "source": "FDA label, Zestril, Warnings"},
    {"a": "lisinopril", "b": "potassium chloride", "severity": "major",
     "concern": "additive hyperkalemia",
     "source": "FDA label, Zestril, Warnings"},
    {"a": "lisinopril", "b": "ibuprofen", "severity": "moderate",
     "concern": "reduced antihypertensive effect and renal risk",
     "source": "FDA label, Zestril, Drug Interactions"},
    {"a": "metformin", "b": "contrast media", "severity": "major",
     "concern": "lactic acidosis risk around iodinated contrast",
     "source": "FDA label, Glucophage, Boxed Warning"},
    {"a": "atorvastatin", "b": "clarithromycin", "severity": "major",
     "concern": "CYP3A4 inhibition raising myopathy risk",
     "source": "FDA label, Lipitor, Drug Interactions"},
    {"a": "atorvastatin", "b": "gemfibrozil", "severity": "major",
     "concern": "additive myopathy and rhabdomyolysis risk",
     "source": "FDA label, Lipitor, Drug Interactions"},
    {"a": "sertraline", "b": "tramadol", "severity": "major",
     "concern": "serotonin syndrome risk",
     "source": "FDA label, Zoloft, Warnings"},
    {"a": "sertraline", "b": "linezolid", "severity": "contraindicated",
     "concern": "serotonin syndrome risk",
     "source": "FDA label, Zoloft, Contraindications"},
    {"a": "sertraline", "b": "ibuprofen", "severity": "moderate",
     "concern": "increased bleeding risk",
     "source": "FDA label, Zoloft, Drug Interactions"},
    {"a": "levothyroxine", "b": "calcium carbonate", "severity": "moderate",
     "concern": "reduced levothyroxine absorption if taken together",
     "source": "FDA label, Synthroid, Drug Interactions"},
    {"a": "furosemide", "b": "lisinopril", "severity": "moderate",
     "concern": "first dose hypotension",
     "source": "FDA label, Lasix, Drug Interactions"},
]


def normalize_ingredient(name: str) -> str:
    return (name or "").strip().lower()


BRAND_TO_INGREDIENT = {
    "coumadin": "warfarin",
    "jantoven": "warfarin",
    "bayer": "aspirin",
    "ecotrin": "aspirin",
    "bufferin": "aspirin",
    "motrin": "ibuprofen",
    "advil": "ibuprofen",
    "aleve": "naproxen",
    "naprosyn": "naproxen",
    "anaprox": "naproxen",
    "diflucan": "fluconazole",
    "zestril": "lisinopril",
    "prinivil": "lisinopril",
    "aldactone": "spironolactone",
    "carospir": "spironolactone",
    "k-dur": "potassium chloride",
    "klor-con": "potassium chloride",
    "k-tab": "potassium chloride",
    "glucophage": "metformin",
    "fortamet": "metformin",
    "riomet": "metformin",
    "omnipaque": "contrast media",
    "isovue": "contrast media",
    "lipitor": "atorvastatin",
    "biaxin": "clarithromycin",
    "lopid": "gemfibrozil",
    "zoloft": "sertraline",
    "ultram": "tramadol",
    "conzip": "tramadol",
    "zyvox": "linezolid",
    "synthroid": "levothyroxine",
    "levoxyl": "levothyroxine",
    "unithroid": "levothyroxine",
    "tums": "calcium carbonate",
    "caltrate": "calcium carbonate",
    "oscal": "calcium carbonate",
    "lasix": "furosemide",
    "furoscix": "furosemide",
}


def _token_pattern(name: str) -> re.Pattern:
    return re.compile(r"(?<![a-z0-9])" + re.escape(name) + r"(?![a-z0-9])")


_COMPILED_BRANDS = [
    (_token_pattern(brand), ingredient)
    for brand, ingredient in sorted(BRAND_TO_INGREDIENT.items(), key=lambda kv: -len(kv[0]))
]


def resolve_brand(text: str) -> Optional[str]:
    for pattern, ingredient in _COMPILED_BRANDS:
        if pattern.search(text):
            return ingredient
    return None


KNOWN_INGREDIENTS = sorted(
    {pair["a"] for pair in INTERACTION_PAIRS} | {pair["b"] for pair in INTERACTION_PAIRS},
    key=len,
    reverse=True,
)


def active_ingredients(medication_requests: List[dict]) -> List[str]:
    out = []
    for request in medication_requests:
        if request.get("status") != "active":
            continue
        text = normalize_ingredient(request.get("medication", ""))
        if not text:
            continue
        match = next(
            (known for known in KNOWN_INGREDIENTS if _token_pattern(known).search(text)),
            None,
        )
        out.append(match or resolve_brand(text) or text.split()[0])
    return [i for i in out if i]


def check_regimen(medication_requests: List[dict]) -> List[dict]:
    present = set(active_ingredients(medication_requests))
    found = []
    for pair in INTERACTION_PAIRS:
        if pair["a"] in present and pair["b"] in present:
            found.append({
                "check_id": "regimen_pair",
                "ingredients": [pair["a"], pair["b"]],
                "severity": pair["severity"],
                "concern": pair["concern"],
                "source": pair["source"],
                "surfaced": SEVERITY_ORDER[pair["severity"]] >= SEVERITY_ORDER[SURFACE_THRESHOLD],
            })
    return sorted(found, key=lambda f: -SEVERITY_ORDER[f["severity"]])


def patient_message(finding: dict) -> Optional[str]:
    if not finding.get("surfaced"):
        return None
    a, b = finding["ingredients"]
    return (
        f"Something on your medication list is worth asking about. Your {a} and "
        f"your {b} appear together on a short list of pairs this prototype "
        "checks for. This is not a review of your medicines and CareLoop cannot "
        "tell you what to do about it. Please contact your prescriber or "
        "pharmacist. Do not start, stop or change any medicine because of this "
        "message."
    )


TAKING_EVERY_DAY_PATTERN = re.compile(
    r"\b(taking|take|takes|took)\b[^.!?]{0,25}\b(every day|daily|every dose|"
    r"as prescribed|without missing|regularly|each day)\b"
    r"|\b(haven'?t|have not|never)\b[^.!?]{0,20}\bmiss(ed)?\b[^.!?]{0,20}\bdose\b",
    re.IGNORECASE,
)

STOPPED_TAKING_PATTERN = re.compile(
    r"\b(stopped|quit|discontinued|not taking|haven'?t been taking|"
    r"ran out and didn'?t restart|gave up on)\b",
    re.IGNORECASE,
)


def check_cross_call(transcript: str, prior_episode: Optional[dict]) -> List[dict]:
    if not prior_episode:
        return []
    if not TAKING_EVERY_DAY_PATTERN.search(transcript or ""):
        return []
    prior_text = " ".join(filter(None, [
        prior_episode.get("transcript"),
        prior_episode.get("summary"),
    ]))
    if not STOPPED_TAKING_PATTERN.search(prior_text):
        return []
    return [{
        "check_id": "cross_call",
        "ingredients": [],
        "severity": "major",
        "concern": (
            "patient now reports taking the medication every day, but the "
            "prior call recorded that they had stopped"
        ),
        "source": "cross-call memory comparison",
        "surfaced": SEVERITY_ORDER["major"] >= SEVERITY_ORDER[SURFACE_THRESHOLD],
    }]


LIMITATIONS = (
    "Hand curated demonstration table of a small number of ingredient pairs. "
    "Not a formulary check and not a drug interaction database. Only the "
    "ingredient names in this table are recognised, together with a short hand "
    "written list of their common brand names, so a brand outside that list is "
    "not resolved and a duplicate ingredient inside a combination product will "
    "be missed. There is no indication, renal "
    "function, dose or timing context. No "
    "clinician reviewed this table, and the labels named in each row were not "
    "consulted when the row was written. A pair missing from this list is not "
    "evidence that the pair is safe."
)
