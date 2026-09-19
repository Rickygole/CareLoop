import json
import sys
from pathlib import Path

EVAL_DIR = Path(__file__).resolve().parent
REPO = EVAL_DIR.parent
CHART_PATH = REPO / "frontend" / "src" / "data" / "eval_results.json"

ARMS = [
    {"id": "naive", "label": "Naive", "note": "raw transcript, single call"},
    {"id": "cot", "label": "Chain of thought", "note": "single call, restate then classify"},
    {"id": "normalize", "label": "Normalize then classify", "note": "CareLoop pipeline"},
]

REGISTER_LABEL = {
    "clinical": "Clinical",
    "casual": "Casual",
    "understated": "Understated",
    "mixed_language": "Mixed-language",
}


def blank_payload():
    categories = list(REGISTER_LABEL.values())
    return {
        "placeholder": True,
        "placeholder_note": (
            "No eval has been run. Every value is zero. Run eval/score.py with a "
            "live API key to replace this file with measured results."
        ),
        "metric": "paraphrase_invariance",
        "metric_label": "Share of paraphrases given the same tier",
        "generated_at": None,
        "model": None,
        "temperature": None,
        "repeats_per_case": 0,
        "cases": 0,
        "arms": ARMS,
        "categories": categories,
        "results": [
            {"category": c, "arm": a["id"], "value": 0, "stderr": 0, "n": 0}
            for c in categories
            for a in ARMS
        ],
    }


def to_chart_payload(results):
    if results.get("dry_run") or results.get("placeholder"):
        raise ValueError(
            "Refusing to export a dry run or placeholder to the chart. "
            "The chart must only ever display numbers from a real run."
        )

    consistency = results.get("consistency_pct", {})
    registers = results.get("registers") or list(REGISTER_LABEL.keys())
    repeats = results.get("repeats", 0)
    scenarios = results.get("scenarios_evaluated", 0)

    categories = [REGISTER_LABEL.get(r, r) for r in registers]
    rows = []
    for register in registers:
        for arm in ARMS:
            pct = consistency.get(arm["id"], {}).get(register)
            rows.append({
                "category": REGISTER_LABEL.get(register, register),
                "arm": arm["id"],
                "value": round(pct / 100.0, 4) if isinstance(pct, (int, float)) else 0,
                "stderr": 0,
                "n": scenarios * repeats,
            })

    return {
        "placeholder": False,
        "placeholder_note": "",
        "metric": "paraphrase_invariance",
        "metric_label": "Share of paraphrases given the same tier",
        "generated_at": results.get("generated_at"),
        "model": results.get("model"),
        "temperature": results.get("temperature"),
        "repeats_per_case": repeats,
        "cases": scenarios,
        "arms": ARMS,
        "categories": categories,
        "results": rows,
        "overall": results.get("overall_consistency_pct", {}),
        "directionality": results.get("directionality", {}),
    }


def export(results_path=None):
    results_path = Path(results_path or (EVAL_DIR / "results.json"))
    if not results_path.exists():
        CHART_PATH.write_text(json.dumps(blank_payload(), indent=2) + "\n")
        return False
    results = json.loads(results_path.read_text())
    CHART_PATH.write_text(json.dumps(to_chart_payload(results), indent=2) + "\n")
    return True


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if export(arg):
        print(f"Exported real results to {CHART_PATH}")
    else:
        print(f"No results.json found. Wrote a zeroed placeholder to {CHART_PATH}")
