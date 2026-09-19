import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "eval"))

CHART = REPO / "frontend" / "src" / "data" / "eval_results.json"
RESULTS = REPO / "eval" / "results.json"


def load_chart():
    if not CHART.exists():
        pytest.skip("frontend chart data not present")
    return json.loads(CHART.read_text())


def test_chart_claims_no_result_without_a_real_run():
    chart = load_chart()
    if chart.get("placeholder"):
        return
    assert RESULTS.exists(), (
        "frontend/src/data/eval_results.json claims placeholder=false but "
        "eval/results.json does not exist. Chart numbers must come from a "
        "real run, never from hand-written values."
    )


def test_placeholder_chart_is_actually_zeroed():
    chart = load_chart()
    if not chart.get("placeholder"):
        return
    values = [row["value"] for row in chart["results"]]
    assert set(values) == {0}, (
        "A placeholder chart must be all zeros. Nonzero values in a file "
        "flagged placeholder will be read as real by anyone looking at it."
    )
    assert chart.get("model") in (None, ""), "A placeholder chart must not name a model."


def test_chart_arms_match_the_eval_harness():
    chart = load_chart()
    from export_chart_v2 import ARMS

    assert [a["id"] for a in chart["arms"]] == [a["id"] for a in ARMS], (
        "Chart arm ids drifted from the eval harness. The chart would render empty."
    )


def test_chart_categories_match_the_eval_conditions():
    chart = load_chart()
    from export_chart_v2 import CONDITION_LABEL

    assert set(chart["categories"]).issubset(set(CONDITION_LABEL.values())), (
        "Chart categories drifted from the conditions the eval actually measures."
    )


def test_chart_carries_its_own_noise_floor():
    chart = load_chart()
    if chart.get("placeholder"):
        return
    assert chart.get("noise_floor") is not None, (
        "A difference smaller than the paraphrase noise floor is not a difference. "
        "The chart must carry that number or it invites over-reading."
    )


def test_chart_headline_does_not_claim_a_gap_that_was_not_found():
    chart = load_chart()
    if chart.get("placeholder"):
        return
    headline = chart.get("headline", "").lower()
    for forbidden in ["closes the gap", "systematically", "proves", "reduced the gap"]:
        assert forbidden not in headline, f"overclaiming language in the chart: {forbidden}"


def test_exporter_refuses_to_publish_a_dry_run():

    from export_chart_v2 import build

    with pytest.raises(Exception):
        build({"dry_run": True})


def test_exporter_refuses_to_publish_a_placeholder():
    from export_chart_v2 import build

    with pytest.raises(Exception):
        build({"placeholder": True})
