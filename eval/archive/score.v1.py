from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

import triage_engine

load_dotenv(REPO_ROOT / ".env")

EVAL_DIR = Path(__file__).resolve().parent
DEFAULT_CASES_PATH = EVAL_DIR / "cases.json"
DEFAULT_RESULTS_PATH = EVAL_DIR / "results.json"
DEFAULT_DRYRUN_RESULTS_PATH = EVAL_DIR / "results.dryrun.json"

ARMS = ["naive", "cot", "normalize"]
REGISTERS = ["clinical", "casual", "understated", "mixed_language"]
TIER_ORDER = {"MILD": 1, "MODERATE": 2, "SEVERE": 3}
TERRITORY_TO_TIER = {"mild": 1, "moderate": 2, "severe": 3}
TIER_LABELS = {1: "MILD", 2: "MODERATE", 3: "SEVERE"}

RUBRIC = """mild: no symptoms, a routine check-in, or a minor tolerable side effect
  (slight nausea, mild tiredness, a small headache).
moderate: a symptom that is interfering with daily life, worsening, or
  warrants a clinician callback within 24 hours (persistent vomiting,
  dizziness on standing, a rash, swelling in the legs, sleeping badly for days).
severe: a symptom that needs same-day clinical attention.

Judge the SYMPTOM, not the vocabulary. Patients describe real symptoms in
casual, indirect, hedged, or non-standard English, and sometimes in a mix of
languages. Never rate something lower because it was phrased informally,
apologetically, minimized, hedged, or in a language other than English."""

NAIVE_PROMPT = """You are a clinical triage classifier for a medication adherence check-in call.
A patient was asked how they are feeling on their medication. Classify the severity
of what they reported.

{rubric}

Patient transcript:
\"\"\"{transcript}\"\"\"

Answer with EXACTLY ONE WORD, one of: MILD, MODERATE, SEVERE"""

COT_PROMPT = """You are a clinical triage classifier for a medication adherence check-in call.
A patient was asked how they are feeling on their medication. Classify the severity
of what they reported.

{rubric}

Patient transcript:
\"\"\"{transcript}\"\"\"

First, in clinical_restatement, restate what the patient said in one or two
sentences of plain clinical terminology, preserving every symptom detail and
keeping the patient's own emphasis and hedging where present. Then classify.

Respond with only this JSON object, no other text, keys in this exact order:
{{"clinical_restatement": "...", "tier": "MILD|MODERATE|SEVERE", "confidence": 0.0, "reasoning": "one sentence"}}"""

NORMALIZE_PROMPT = triage_engine.TIER1_PROMPT

DEFAULT_MODEL = os.environ.get("GEMINI_MODEL") or triage_engine.DEFAULT_MODEL


def det_rand(*parts):
    digest = hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def load_cases(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    offenders = []
    for scenario in data["scenarios"]:
        for register, text in scenario["paraphrases"].items():
            hits = triage_engine.detect_emergency(text)
            if hits:
                offenders.append((scenario["id"], register, hits))
    if offenders:
        lines = [
            "One or more eval paraphrases trip Tier 0 deterministic emergency rules.",
            "That makes them Tier 0 cases, not Tier 1 cases, and invalidates the arms comparison.",
        ]
        for scenario_id, register, hits in offenders:
            lines.append(f"  {scenario_id} / {register}: matched {hits}")
        raise SystemExit("\n".join(lines))
    return data


def extract_json_object(text):
    if not text:
        return None
    stripped = text.strip()
    stripped = re.sub(r"^```(json)?", "", stripped.strip())
    stripped = re.sub(r"```$", "", stripped.strip())
    match = re.search(r"\{.*\}", stripped, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except (ValueError, TypeError):
        return None


def parse_tier_word(text):
    if not text:
        return None
    upper = text.strip().upper()
    for word in ("SEVERE", "MODERATE", "MILD"):
        if re.search(r"\b" + word + r"\b", upper):
            return word
    return None


class ApiCallCounter:
    def __init__(self):
        self.count = 0

    def increment(self):
        self.count += 1


def build_gemini_caller(model_name, temperature, max_output_tokens, sleep_seconds, counter):
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit(
            "GEMINI_API_KEY is not set. Real eval runs require a key.\n"
            "Set it in .env, or use --dry-run to exercise the pipeline offline."
        )
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    def call(prompt, json_mode):
        counter.increment()
        generation_config = {
            "temperature": temperature,
            "max_output_tokens": max_output_tokens,
        }
        if json_mode:
            generation_config["response_mime_type"] = "application/json"
        response = model.generate_content(
            prompt,
            generation_config=generation_config,
            request_options={"timeout": 20},
        )
        if sleep_seconds:
            time.sleep(sleep_seconds)
        return (response.text or "").strip()

    return call


def verify_model_resolves(model_name):
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise SystemExit("GEMINI_API_KEY is not set, cannot verify model resolution.")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)
    try:
        response = model.generate_content(
            "Reply with exactly one word: OK",
            generation_config={"temperature": 0.0, "max_output_tokens": 10},
            request_options={"timeout": 20},
        )
        text = (response.text or "").strip()
        if not text:
            print(f"Model '{model_name}' responded but with empty text. Treat as unresolved.")
            return False
        print(f"Model '{model_name}' resolves on the installed SDK. Sample reply: {text!r}")
        return True
    except Exception as exc:
        print(f"Model '{model_name}' did NOT resolve on the installed SDK.")
        print(f"  google-generativeai raised: {type(exc).__name__}: {exc}")
        return False


def classify_naive_real(caller, transcript):
    raw = caller(NAIVE_PROMPT.format(rubric=RUBRIC, transcript=transcript), json_mode=False)
    tier = parse_tier_word(raw)
    return tier, None, raw


def classify_cot_real(caller, transcript):
    raw = caller(COT_PROMPT.format(rubric=RUBRIC, transcript=transcript), json_mode=True)
    obj = extract_json_object(raw)
    if obj is not None:
        tier = parse_tier_word(str(obj.get("tier", "")))
        extra = obj.get("clinical_restatement")
        return tier, extra, raw
    return parse_tier_word(raw), None, raw


def classify_normalize_real(caller, transcript):
    raw = caller(NORMALIZE_PROMPT.format(transcript=transcript), json_mode=True)
    verdict = triage_engine._parse_llm_response(raw)
    tier = verdict.severity.label if verdict.severity else None
    return tier, verdict.normalized_text, raw


REAL_CLASSIFIERS = {
    "naive": classify_naive_real,
    "cot": classify_cot_real,
    "normalize": classify_normalize_real,
}


def classify_fake(arm, scenario, register, repeat_index):
    baseline = TERRITORY_TO_TIER[scenario["territory"]]
    noise = det_rand(arm, scenario["id"], register, str(repeat_index))
    if arm == "naive":
        drop_probability = 0.7 if register in ("understated", "mixed_language") else 0.0
    elif arm == "cot":
        drop_probability = 0.3 if register in ("understated", "mixed_language") else 0.0
    else:
        drop_probability = 0.05
    tier_int = max(1, baseline - 1) if noise < drop_probability else baseline
    tier = TIER_LABELS[tier_int]
    extra = None
    if arm in ("cot", "normalize"):
        extra = f"[dry-run fake restatement for {scenario['id']}/{register}]"
    raw = f"[dry-run] tier={tier}"
    return tier, extra, raw


def run_matrix(data, arms, registers, repeats, real_caller, dry_run, counter):
    scenario_results = {}
    errors = []
    for scenario in data["scenarios"]:
        scenario_results[scenario["id"]] = {}
        for arm in arms:
            register_repeats = {}
            for register in registers:
                transcript = scenario["paraphrases"][register]
                tiers = []
                extras = []
                for repeat_index in range(repeats):
                    if dry_run:
                        tier, extra, raw = classify_fake(arm, scenario, register, repeat_index)
                    else:
                        try:
                            tier, extra, raw = REAL_CLASSIFIERS[arm](real_caller, transcript)
                        except Exception as exc:
                            tier, extra, raw = None, None, f"ERROR: {exc}"
                    if tier is None:
                        errors.append(
                            {
                                "scenario_id": scenario["id"],
                                "arm": arm,
                                "register": register,
                                "repeat_index": repeat_index,
                                "raw": raw,
                            }
                        )
                    tiers.append(tier)
                    extras.append(extra)
                register_repeats[register] = {"tiers": tiers, "extras": extras}
            scenario_results[scenario["id"]][arm] = register_repeats
    return scenario_results, errors


def mode_with_severity_tiebreak(values):
    valid = [v for v in values if v]
    if not valid:
        return None
    counts = Counter(valid)
    top_count = max(counts.values())
    candidates = [v for v, c in counts.items() if c == top_count]
    return max(candidates, key=lambda v: TIER_ORDER[v])


def modal_tier_for_register(register_entry):
    return mode_with_severity_tiebreak(register_entry["tiers"])


def spread_for_register(register_entry):
    valid = [TIER_ORDER[t] for t in register_entry["tiers"] if t]
    if not valid:
        return {"n_valid": 0, "n_total": len(register_entry["tiers"]), "mean": None, "unique_tiers": 0}
    mean_value = sum(valid) / len(valid)
    return {
        "n_valid": len(valid),
        "n_total": len(register_entry["tiers"]),
        "mean": round(mean_value, 3),
        "unique_tiers": len(set(valid)),
    }


def summarize(data, scenario_results, arms, registers):
    per_arm = {}
    directionality = {arm: {"lower": 0, "higher": 0, "examples": []} for arm in arms}

    for arm in arms:
        scenario_consistency = []
        register_agree_count = {r: 0 for r in registers}
        register_total_count = {r: 0 for r in registers}
        scenario_detail = {}

        for scenario in data["scenarios"]:
            register_entries = scenario_results[scenario["id"]][arm]
            modal_by_register = {
                r: modal_tier_for_register(register_entries[r]) for r in registers
            }
            spread_by_register = {
                r: spread_for_register(register_entries[r]) for r in registers
            }
            majority = mode_with_severity_tiebreak(list(modal_by_register.values()))

            pairs = []
            reg_list = list(registers)
            for i in range(len(reg_list)):
                for j in range(i + 1, len(reg_list)):
                    a, b = reg_list[i], reg_list[j]
                    ta, tb = modal_by_register[a], modal_by_register[b]
                    pairs.append(bool(ta and tb and ta == tb))
            pairwise_consistency = sum(pairs) / len(pairs) if pairs else 0.0
            scenario_consistency.append(pairwise_consistency)

            for r in registers:
                register_total_count[r] += 1
                tier = modal_by_register[r]
                if majority and tier == majority:
                    register_agree_count[r] += 1
                elif majority and tier:
                    direction = "lower" if TIER_ORDER[tier] < TIER_ORDER[majority] else "higher"
                    directionality[arm][direction] += 1
                    directionality[arm]["examples"].append(
                        {
                            "scenario_id": scenario["id"],
                            "register": r,
                            "register_tier": tier,
                            "majority_tier": majority,
                        }
                    )

            scenario_detail[scenario["id"]] = {
                "territory": scenario["territory"],
                "modal_tier_by_register": modal_by_register,
                "spread_by_register": spread_by_register,
                "majority_tier": majority,
                "all_registers_agree": len(set(v for v in modal_by_register.values() if v)) <= 1
                and all(modal_by_register.values()),
                "pairwise_consistency_pct": round(pairwise_consistency * 100, 1),
            }

        overall_consistency_pct = round(
            100 * sum(scenario_consistency) / len(scenario_consistency), 1
        ) if scenario_consistency else 0.0

        per_register_consistency_pct = {
            r: round(100 * register_agree_count[r] / register_total_count[r], 1)
            if register_total_count[r]
            else 0.0
            for r in registers
        }

        per_arm[arm] = {
            "overall_consistency_pct": overall_consistency_pct,
            "per_register_consistency_pct": per_register_consistency_pct,
            "scenario_detail": scenario_detail,
        }

    return per_arm, directionality


def print_summary_table(results):
    print()
    print("Triage consistency across phrasing styles (paraphrase invariance eval)")
    print("=" * 74)
    print(f"model: {results['model']}   temperature: {results['temperature']}   "
          f"repeats: {results['repeats']}   dry_run: {results['dry_run']}")
    print()
    header = f"{'arm':<10}" + "".join(f"{r:<18}" for r in results["registers"]) + f"{'overall':<10}"
    print(header)
    print("-" * len(header))
    for arm in results["arms"]:
        row = f"{arm:<10}"
        for r in results["registers"]:
            pct = results["consistency_pct"][arm][r]
            row += f"{pct:<18}"
        row += f"{results['overall_consistency_pct'][arm]:<10}"
        print(row)
    print()
    print("Directionality (when a register disagrees with the scenario majority,")
    print("which way does it land):")
    for arm in results["arms"]:
        d = results["directionality"][arm]
        total = d["lower"] + d["higher"]
        if total == 0:
            print(f"  {arm}: no disagreements observed")
            continue
        lower_pct = round(100 * d["lower"] / total, 1)
        print(f"  {arm}: {d['lower']} lower / {d['higher']} higher out of {total} "
              f"disagreements ({lower_pct}% land lower than the majority)")
    if results["errors"]:
        print()
        print(f"WARNING: {len(results['errors'])} classification call(s) returned an "
              f"unparseable or missing tier. See 'errors' in the results file.")
    print()


def build_results_payload(data, scenario_results, per_arm, directionality, errors, args, total_calls, dry_run):
    consistency_pct = {arm: per_arm[arm]["per_register_consistency_pct"] for arm in ARMS}
    overall_consistency_pct = {arm: per_arm[arm]["overall_consistency_pct"] for arm in ARMS}
    scenario_detail = {arm: per_arm[arm]["scenario_detail"] for arm in ARMS}

    return {
        "placeholder": False if not dry_run else True,
        "dry_run": dry_run,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "temperature": args.temperature,
        "repeats": args.repeats,
        "total_api_calls": total_calls,
        "scenarios_evaluated": len(data["scenarios"]),
        "registers": REGISTERS,
        "arms": ARMS,
        "consistency_pct": consistency_pct,
        "overall_consistency_pct": overall_consistency_pct,
        "scenario_detail": scenario_detail,
        "directionality": directionality,
        "errors": errors,
        "note": data["note"],
    }


def parse_args():
    parser = argparse.ArgumentParser(description="CareLoop paraphrase invariance eval")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check-model", action="store_true")
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-output-tokens", type=int, default=300)
    parser.add_argument("--sleep", type=float, default=0.0)
    parser.add_argument("--cases", default=str(DEFAULT_CASES_PATH))
    parser.add_argument("--out", default=str(DEFAULT_RESULTS_PATH))
    return parser.parse_args()


def main():
    args = parse_args()

    if args.check_model:
        if args.dry_run:
            raise SystemExit("--check-model and --dry-run cannot be combined.")
        ok = verify_model_resolves(args.model)
        sys.exit(0 if ok else 1)

    if not args.dry_run and not os.environ.get("GEMINI_API_KEY"):
        raise SystemExit(
            "GEMINI_API_KEY is not set in the environment or .env file.\n"
            "Refusing to run the real eval without a key, and refusing to write\n"
            "a results.json with invented numbers.\n"
            "Use --dry-run to exercise the pipeline offline with a fake classifier,\n"
            "or set GEMINI_API_KEY and re-run."
        )

    data = load_cases(args.cases)
    counter = ApiCallCounter()

    real_caller = None
    if not args.dry_run:
        print(f"Verifying that model '{args.model}' resolves before spending the full budget...")
        if not verify_model_resolves(args.model):
            raise SystemExit(
                f"Model '{args.model}' does not resolve on the installed google-generativeai SDK.\n"
                "Refusing to run the full matrix against a model that will fail on every call.\n"
                "Set GEMINI_MODEL in .env, or pass --model, to a model id that resolves."
            )
        real_caller = build_gemini_caller(
            args.model, args.temperature, args.max_output_tokens, args.sleep, counter
        )

    scenario_results, errors = run_matrix(
        data, ARMS, REGISTERS, args.repeats, real_caller, args.dry_run, counter
    )
    per_arm, directionality = summarize(data, scenario_results, ARMS, REGISTERS)

    total_calls = counter.count if not args.dry_run else 0

    results = build_results_payload(
        data, scenario_results, per_arm, directionality, errors, args, total_calls, args.dry_run
    )

    out_path = Path(args.out)
    if args.dry_run:
        out_path = DEFAULT_DRYRUN_RESULTS_PATH
        print(f"Dry run: writing to {out_path} instead of {args.out} "
              f"so a fake run can never be mistaken for eval/results.json.")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        f.write("\n")

    print_summary_table(results)
    print(f"Wrote {out_path}")

    if not args.dry_run:
        from export_chart import export

        export(out_path)
        print("Exported chart data to frontend/src/data/eval_results.json")

    if errors and not args.dry_run:
        print(f"{len(errors)} call(s) failed to parse. Exiting nonzero so this is not missed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
