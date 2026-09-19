import json
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
REPO = EVAL_DIR.parent
CHART_PATH = REPO / "frontend" / "src" / "data" / "eval_results.json"

ARMS = [
    {"id": "naive", "label": "Model only", "note": "transcript straight to the model"},
    {"id": "rules_only", "label": "Safety rules, then model", "note": "deterministic rules run first"},
    {"id": "full", "label": "CareLoop", "note": "rewrite, then rules, then model"},
]

CONDITION_LABEL = {
    "A": "Clinical",
    "A_prime": "Reworded",
    "B": "Casual",
    "C": "Dialect",
    "D": "Casual and dialect",
}

METRIC = "over_triage_rate_gold_moderate"


def build(results):
    m = results["metrics_all"]
    conditions = [c for c in CONDITION_LABEL if c in m["naive"]]
    rows = []
    for cond in conditions:
        for arm in ARMS:
            entry = m[arm["id"]][cond][METRIC]
            rows.append({
                "category": CONDITION_LABEL[cond],
                "arm": arm["id"],
                "value": round(entry["rate"], 4),
                "stderr": 0,
                "n": entry["n"],
            })

    noise = results.get("noise_floor_a_vs_a_prime", {})
    floor = max(
        (1.0 - noise.get(a["id"], {}).get("agreement_rate", 1.0)) for a in ARMS
    ) if noise else None

    return {
        "placeholder": False,
        "placeholder_note": "",
        "metric": METRIC,
        "metric_label": "How often a moderate case was raised above moderate",
        "generated_at": results.get("generated_at"),
        "model": results.get("model"),
        "temperature": results.get("temperature"),
        "repeats_per_case": results.get("k"),
        "cases": 24,
        "arms": ARMS,
        "categories": [CONDITION_LABEL[c] for c in conditions],
        "results": rows,
        "noise_floor": round(floor, 4) if floor is not None else None,
        "noise_floor_label": (
            "The model disagrees with itself this often on the same case simply "
            "reworded. Any difference smaller than this is not a difference."
        ),
        "headline": (
            "We predicted that casual and dialect phrasing would be under-triaged. "
            "It was not. Under-triage was zero in every arm and every condition, so "
            "there was no gap to close. What the run did show is what the safety "
            "rules cost: they raise more moderate cases than the model alone."
        ),
        "methodology_note": "v2, 24 vignettes, 5 phrasings, 3 arms, k=3, 1080 live calls.",
    }


if __name__ == "__main__":
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else EVAL_DIR / "results.v2.json"
    results = json.loads(src.read_text())
    if results.get("dry_run"):
        raise SystemExit("refusing to publish a dry run")
    CHART_PATH.write_text(json.dumps(build(results), indent=2) + "\n")
    print(f"exported v2 results to {CHART_PATH}")
