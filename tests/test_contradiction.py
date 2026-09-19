import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from contradiction import (
    INTERACTION_PAIRS,
    LIMITATIONS,
    active_ingredients,
    check_regimen,
)


def meds(*names):
    return [{"medication": name, "status": "active"} for name in names]


def finding_for(findings, a, b):
    return next(
        (f for f in findings if set(f["ingredients"]) == {a, b}),
        None,
    )


def test_coumadin_and_aspirin_surface_the_warfarin_pair():
    findings = check_regimen(meds("Coumadin 5mg", "Aspirin 81mg"))
    found = finding_for(findings, "warfarin", "aspirin")
    assert found, (
        "a prescription written as Coumadin is warfarin, and the table's own "
        f"row cites the Coumadin label: {findings!r}"
    )
    assert found["severity"] == "major"
    assert found["surfaced"] is True


@pytest.mark.parametrize("first,second,a,b", [
    ("Zestril 10 mg tablet", "Aldactone 25 mg tablet", "lisinopril", "spironolactone"),
    ("Lipitor 20 mg tablet", "Biaxin 500 mg tablet", "atorvastatin", "clarithromycin"),
    ("Zoloft 50 mg tablet", "Ultram 50 mg tablet", "sertraline", "tramadol"),
    ("Zestril 10 mg tablet", "K-Dur 20 mEq tablet", "lisinopril", "potassium chloride"),
    ("Synthroid 75 mcg tablet", "Tums 500 mg chewable", "levothyroxine", "calcium carbonate"),
    ("Glucophage 500 mg tablet", "Motrin 400 mg tablet", "metformin", "ibuprofen"),
])
def test_brand_names_resolve_to_their_active_ingredient(first, second, a, b):
    resolved = active_ingredients(meds(first, second))
    assert resolved == [a, b], f"{first} and {second} resolved to {resolved!r}"


@pytest.mark.parametrize("first,second,a,b", [
    ("Zestril 10 mg tablet", "Aldactone 25 mg tablet", "lisinopril", "spironolactone"),
    ("Lipitor 20 mg tablet", "Biaxin 500 mg tablet", "atorvastatin", "clarithromycin"),
    ("Zoloft 50 mg tablet", "Ultram 50 mg tablet", "sertraline", "tramadol"),
    ("Lipitor 20 mg tablet", "Lopid 600 mg tablet", "atorvastatin", "gemfibrozil"),
])
def test_brand_pairs_reach_the_same_finding_as_their_generics(first, second, a, b):
    assert finding_for(check_regimen(meds(first, second)), a, b), (
        f"{first} plus {second} must reach the {a} plus {b} row"
    )


@pytest.mark.parametrize("text", [
    "COUMADIN 5 MG",
    "coumadin",
    "Coumadin 5mg tablet",
    "  CoUmAdIn 5 mg tab, take with food  ",
    "Jantoven 5 mg tablet",
])
def test_case_and_dose_text_do_not_hide_a_brand(text):
    assert active_ingredients(meds(text)) == ["warfarin"]


def test_an_unknown_brand_falls_back_and_never_guesses():
    resolved = active_ingredients(meds("Zephyrax 10 mg tablet"))
    assert resolved == ["zephyrax"], (
        "an unrecognised name keeps the existing fallback rather than being "
        f"attached to an ingredient: {resolved!r}"
    )
    assert check_regimen(meds("Zephyrax 10 mg tablet", "Coumadin 5mg")) == []


@pytest.mark.parametrize("text,trap", [
    ("Clopidogrel 75 mg tablet", "gemfibrozil"),
    ("clopidogrel bisulfate 75 mg", "gemfibrozil"),
])
def test_a_brand_inside_a_longer_word_is_not_a_match(text, trap):
    resolved = active_ingredients(meds(text))
    assert trap not in resolved, (
        f"{text!r} resolved to {resolved!r}. Lopid sits inside clopidogrel, and "
        "a substring match would tell a patient their statin and their "
        "antiplatelet interact when the table says nothing of the kind."
    )


def test_the_substring_trap_produces_no_finding_alongside_a_statin():
    findings = check_regimen(meds("Lipitor 20 mg tablet", "Clopidogrel 75 mg tablet"))
    assert findings == [], f"false positive: {findings!r}"


@pytest.mark.parametrize("first,second,a,b", [
    ("Warfarin 5 mg tablet", "Aspirin 81 mg tablet", "warfarin", "aspirin"),
    ("Lisinopril 10 mg tablet", "Spironolactone 25 mg tablet", "lisinopril", "spironolactone"),
    ("Levothyroxine 75 mcg tablet", "Calcium carbonate 500 mg", "levothyroxine", "calcium carbonate"),
    ("Sertraline 50 mg tablet", "Linezolid 600 mg tablet", "sertraline", "linezolid"),
    ("Lisinopril 10 mg tablet", "Potassium chloride 20 mEq", "lisinopril", "potassium chloride"),
    ("Metformin 500 mg tablet", "Contrast media", "metformin", "contrast media"),
    ("Warfarin 5 mg tablet", "Fluconazole 150 mg tablet", "warfarin", "fluconazole"),
    ("Furosemide 20 mg tablet", "Lisinopril 10 mg tablet", "furosemide", "lisinopril"),
    ("Atorvastatin 20 mg tablet", "Gemfibrozil 600 mg tablet", "atorvastatin", "gemfibrozil"),
    ("Sertraline 50 mg tablet", "Naproxen 500 mg tablet", "sertraline", None),
])
def test_generic_names_behave_exactly_as_before(first, second, a, b):
    resolved = active_ingredients(meds(first, second))
    assert resolved[0] == a
    if b is not None:
        assert resolved[1] == b
        assert finding_for(check_regimen(meds(first, second)), a, b)


def test_a_brand_on_an_inactive_request_is_still_ignored():
    requests = [
        {"medication": "Coumadin 5mg", "status": "active"},
        {"medication": "Bayer Aspirin 81 mg", "status": "stopped"},
    ]
    assert active_ingredients(requests) == ["warfarin"]
    assert check_regimen(requests) == []


def test_every_ingredient_in_the_table_has_at_least_one_brand():
    from contradiction import BRAND_TO_INGREDIENT

    ingredients = {p["a"] for p in INTERACTION_PAIRS} | {p["b"] for p in INTERACTION_PAIRS}
    missing = sorted(ingredients - set(BRAND_TO_INGREDIENT.values()))
    assert not missing, f"no brand mapped to: {missing}"


def test_no_brand_maps_to_an_ingredient_the_table_does_not_know():
    from contradiction import BRAND_TO_INGREDIENT, KNOWN_INGREDIENTS

    unknown = sorted(set(BRAND_TO_INGREDIENT.values()) - set(KNOWN_INGREDIENTS))
    assert not unknown, f"brands point at ingredients with no row: {unknown}"


def test_limitations_no_longer_claim_brand_names_are_unresolved():
    assert "brand names and combination products are not resolved" not in LIMITATIONS
    assert "brand" in LIMITATIONS.lower()
    assert "combination product" in LIMITATIONS.lower()
    assert "not a formulary check" in LIMITATIONS.lower()
    assert "hand curated" in LIMITATIONS.lower()
    assert (
        "A pair missing from this list is not evidence that the pair is safe."
        in LIMITATIONS
    )
