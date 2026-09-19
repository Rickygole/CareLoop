from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import random
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

import triage_engine

load_dotenv(REPO_ROOT / ".env")

CONDITIONS = ["A", "A_prime", "B", "C", "D"]
ARMS = ["naive", "rules_only", "full"]
TIER_ORDER = {"mild": 1, "moderate": 2, "severe": 3}
TIER_FROM_ORDER = {v: k for k, v in TIER_ORDER.items()}
EMERGENCY_AS_TIER = "severe"
UNDER_TRIAGE_GOLD_TIERS = ["severe", "moderate"]
OVER_TRIAGE_GOLD_TIERS = ["mild", "moderate"]

DEFAULT_VIGNETTES_PATH = EVAL_DIR / "vignettes.v2.json"
DEFAULT_RUBRIC_PATH = REPO_ROOT / "docs" / "TIER_RUBRIC.md"
DEFAULT_OUT_PATH = EVAL_DIR / "results_v2.json"
DEFAULT_DRYRUN_OUT_PATH = EVAL_DIR / "results_v2.dryrun.json"
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL") or triage_engine.DEFAULT_MODEL
DEFAULT_K = 3
DEFAULT_RESAMPLES = 10000
DEFAULT_SEED = 20260919

FALLBACK_RUBRIC_TEXT = """mild: no symptoms, or a known tolerable side effect, not worsening.
moderate: interferes with daily activity, persistent or worsening, warrants
  a callback within 24 hours.
severe: needs same-day clinical attention.

EMERGENCY scores as severe for all evaluation purposes.

Ties go to the higher tier. Hedging is not evidence of mildness. A third
party report is scored the same as first person.

[dry-run fallback rubric text, shorter than docs/TIER_RUBRIC.md, never used
for a real scoring run]"""

REFUSAL_MARKERS = [
    "i cannot", "i can't", "i'm not able", "i am not able", "i won't",
    "unable to assist", "cannot provide", "not able to help",
    "as an ai", "i'm unable",
]

CLASSIFY_PROMPT = """You are a clinical triage classifier for a medication \
adherence check-in call. A patient was asked how they are feeling on their \
medication. Classify the severity of what they reported.

{rubric}

Patient transcript:
\"\"\"{transcript}\"\"\"

Respond with only this JSON object, no other text:
{{"tier": "mild|moderate|severe", "confidence": 0.0, "reasoning": "one sentence"}}"""

NORMALIZE_PROMPT = """You are preparing a patient transcript for a downstream \
clinical severity classifier. Restate what the patient said in standard, \
neutral clinical phrasing. Preserve every symptom detail they mentioned. Do \
not add symptoms they did not mention. Do not soften or escalate severity. \
Do not classify severity yourself.

Patient transcript:
\"\"\"{transcript}\"\"\"

Respond with only this JSON object, no other text:
{{"normalized_text": "...", "reasoning": "one sentence"}}"""


def det_rand(*parts):
    digest = hashlib.sha256(":".join(parts).encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def read_rubric_text(path, dry_run):
    path = Path(path)
    if path.exists():
        return path.read_text(encoding="utf-8").strip(), True
    if dry_run:
        return FALLBACK_RUBRIC_TEXT, False
    raise SystemExit(
        f"{path} does not exist. A real (non-dry-run) scoring pass refuses to "
        "guess at the rubric. Use --dry-run to exercise the pipeline with a "
        "built-in fallback rubric instead."
    )


def load_vignettes(path):
    path = Path(path)
    if not path.exists():
        raise SystemExit(f"{path} does not exist.")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if data.get("schema_version") != 2:
        raise SystemExit(f"{path}: schema_version must be 2.")

    conditions = data.get("conditions")
    if not conditions or set(conditions.keys()) != set(CONDITIONS):
        raise SystemExit(f"{path}: conditions must be exactly {CONDITIONS}.")

    vignettes = data.get("vignettes") or []
    ids = [v["id"] for v in vignettes]
    if len(ids) != len(set(ids)):
        dupes = [i for i, c in Counter(ids).items() if c > 1]
        raise SystemExit(f"{path}: duplicate vignette ids: {dupes}")

    for v in vignettes:
        if v.get("gold") not in TIER_ORDER:
            raise SystemExit(f"{path}: vignette {v.get('id')} has invalid gold tier {v.get('gold')!r}.")
        if v.get("split") not in ("dev", "test"):
            raise SystemExit(f"{path}: vignette {v.get('id')} has invalid split {v.get('split')!r}.")
        text = v.get("text") or {}
        if set(text.keys()) != set(CONDITIONS):
            raise SystemExit(f"{path}: vignette {v.get('id')} text must have exactly {CONDITIONS}.")

    n_dev = sum(1 for v in vignettes if v["split"] == "dev")
    n_test = sum(1 for v in vignettes if v["split"] == "test")

    provenance = data.get("provenance") or {}
    return {
        "vignettes": vignettes,
        "provenance": provenance,
        "n_total": len(vignettes),
        "n_dev": n_dev,
        "n_test": n_test,
        "raw": data,
    }


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
    for word, tier in (("SEVERE", "severe"), ("MODERATE", "moderate"), ("MILD", "mild")):
        if re.search(r"\b" + word + r"\b", upper):
            return tier
    return None


def classify_outcome(raw, tier):
    if tier is not None:
        return "parsed"
    lowered = (raw or "").lower()
    for marker in REFUSAL_MARKERS:
        if marker in lowered:
            return "refusal"
    return "parse_failure"


def rule_gate(text):
    return triage_engine.detect_emergency(text or "")


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
            "Use --dry-run to exercise the pipeline offline."
        )
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_name)

    def call(prompt):
        counter.increment()
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_output_tokens,
                "response_mime_type": "application/json",
            },
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
        print(f"Model '{model_name}' resolves. Sample reply: {text!r}")
        return True
    except Exception as exc:
        print(f"Model '{model_name}' did NOT resolve: {type(exc).__name__}: {exc}")
        return False


def real_classify(caller, rubric_text, transcript):
    raw = caller(CLASSIFY_PROMPT.format(rubric=rubric_text, transcript=transcript))
    obj = extract_json_object(raw)
    tier = parse_tier_word(str(obj.get("tier", ""))) if obj else parse_tier_word(raw)
    return tier, raw


def real_normalize(caller, transcript):
    raw = caller(NORMALIZE_PROMPT.format(transcript=transcript))
    obj = extract_json_object(raw)
    normalized = obj.get("normalized_text") if obj else None
    ok = bool(normalized and normalized.strip())
    return (normalized.strip() if ok else None), ok, raw


def fake_classify(arm, vignette, condition, run_index):
    gold = vignette["gold"]
    baseline = TIER_ORDER[gold]

    outcome_noise = det_rand(arm, vignette["id"], condition, str(run_index), "outcome")
    if outcome_noise < 0.02:
        return None, "[dry-run] simulated refusal: I cannot classify this transcript."
    if outcome_noise < 0.04:
        return None, "[dry-run] simulated garbled output ###not-json###"

    drop_probability = {
        "A": 0.0,
        "A_prime": 0.05,
        "B": 0.1,
        "C": 0.3,
        "D": 0.45,
    }[condition]
    if arm == "full":
        drop_probability *= 0.35
    elif arm == "rules_only":
        drop_probability *= 0.8

    noise = det_rand(arm, vignette["id"], condition, str(run_index), "tier")
    tier_int = max(1, baseline - 1) if noise < drop_probability else baseline
    tier = TIER_FROM_ORDER[tier_int]
    return tier, f"[dry-run] tier={tier}"


def fake_normalize(vignette, condition):
    text = vignette["text"][condition]
    return text, True, "[dry-run] normalization is a documented no-op pass-through of the raw text"


def run_arm(arm, vignette, condition, run_index, rubric_text, dry_run, real_caller):
    text = vignette["text"][condition]

    if arm == "naive":
        if dry_run:
            tier, raw = fake_classify(arm, vignette, condition, run_index)
        else:
            tier, raw = real_classify(real_caller, rubric_text, text)
        outcome = classify_outcome(raw, tier)
        return {
            "tier": tier,
            "outcome": outcome,
            "raw_classify": raw,
            "raw_normalize": None,
            "normalized_text": None,
            "normalize_ok": None,
            "rule_hits": [],
        }

    if arm == "rules_only":
        hits = rule_gate(text)
        if hits:
            return {
                "tier": EMERGENCY_AS_TIER,
                "outcome": "rule_escalation",
                "raw_classify": None,
                "raw_normalize": None,
                "normalized_text": None,
                "normalize_ok": None,
                "rule_hits": hits,
            }
        if dry_run:
            tier, raw = fake_classify(arm, vignette, condition, run_index)
        else:
            tier, raw = real_classify(real_caller, rubric_text, text)
        outcome = classify_outcome(raw, tier)
        return {
            "tier": tier,
            "outcome": outcome,
            "raw_classify": raw,
            "raw_normalize": None,
            "normalized_text": None,
            "normalize_ok": None,
            "rule_hits": [],
        }

    if arm == "full":
        if dry_run:
            normalized_text, normalize_ok, norm_raw = fake_normalize(vignette, condition)
        else:
            normalized_text, normalize_ok, norm_raw = real_normalize(real_caller, text)
        gate_text = normalized_text if normalize_ok else text
        hits = rule_gate(gate_text)
        if hits:
            return {
                "tier": EMERGENCY_AS_TIER,
                "outcome": "rule_escalation",
                "raw_classify": None,
                "raw_normalize": norm_raw,
                "normalized_text": normalized_text,
                "normalize_ok": normalize_ok,
                "rule_hits": hits,
            }
        classify_text = normalized_text if normalize_ok else text
        if dry_run:
            tier, raw = fake_classify(arm, vignette, condition, run_index)
        else:
            tier, raw = real_classify(real_caller, rubric_text, classify_text)
        outcome = classify_outcome(raw, tier)
        if not normalize_ok:
            outcome = "normalize_failed_" + outcome
        return {
            "tier": tier,
            "outcome": outcome,
            "raw_classify": raw,
            "raw_normalize": norm_raw,
            "normalized_text": normalized_text,
            "normalize_ok": normalize_ok,
            "rule_hits": [],
        }

    raise ValueError(f"unknown arm {arm!r}")


def mode_with_severity_tiebreak(values):
    valid = [v for v in values if v]
    if not valid:
        return None
    counts = Counter(valid)
    top_count = max(counts.values())
    candidates = [v for v, c in counts.items() if c == top_count]
    return max(candidates, key=lambda v: TIER_ORDER[v])


def run_matrix(data, k, dry_run, rubric_text, real_caller):
    predictions = {}
    for vignette in data["vignettes"]:
        predictions[vignette["id"]] = {}
        for arm in ARMS:
            predictions[vignette["id"]][arm] = {}
            for condition in CONDITIONS:
                runs = []
                for run_index in range(k):
                    result = run_arm(arm, vignette, condition, run_index, rubric_text, dry_run, real_caller)
                    runs.append(result)
                predictions[vignette["id"]][arm][condition] = runs
    return predictions


def consensus_for(runs):
    tiers = [r["tier"] for r in runs]
    consensus = mode_with_severity_tiebreak(tiers)
    valid = [t for t in tiers if t]
    agree = len(set(valid)) <= 1 and len(valid) == len(tiers)
    return consensus, agree, tiers


def build_consensus(predictions):
    consensus = {}
    for vid, by_arm in predictions.items():
        consensus[vid] = {}
        for arm, by_cond in by_arm.items():
            consensus[vid][arm] = {}
            for cond, runs in by_cond.items():
                tier, agree, tiers = consensus_for(runs)
                consensus[vid][arm][cond] = {
                    "tier": tier,
                    "run_to_run_agree": agree,
                    "run_tiers": tiers,
                    "outcomes": [r["outcome"] for r in runs],
                    "rule_hits": runs[0]["rule_hits"] if runs else [],
                }
    return consensus


def vignette_index(data):
    return {v["id"]: v for v in data["vignettes"]}


def under_triage_value(pred_tier, gold_tier):
    if pred_tier is None:
        return None
    return 1 if TIER_ORDER[pred_tier] < TIER_ORDER[gold_tier] else 0


def over_triage_value(pred_tier, gold_tier):
    if pred_tier is None:
        return None
    return 1 if TIER_ORDER[pred_tier] > TIER_ORDER[gold_tier] else 0


def signed_error_value(pred_tier, gold_tier):
    if pred_tier is None:
        return None
    return TIER_ORDER[pred_tier] - TIER_ORDER[gold_tier]


def exact_match_value(pred_tier, gold_tier):
    if pred_tier is None:
        return None
    return 1 if pred_tier == gold_tier else 0


def rate(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)


def cluster_bootstrap_ci_impl(values_by_id, n_resamples=DEFAULT_RESAMPLES, seed=DEFAULT_SEED):
    ids = list(values_by_id.keys())
    n = len(ids)
    if n == 0:
        return {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0}
    rng = random.Random(seed)
    stats = []
    for _ in range(n_resamples):
        total = 0.0
        for _ in range(n):
            total += values_by_id[ids[rng.randrange(n)]]
        stats.append(total / n)
    stats.sort()
    lo_idx = int(0.025 * len(stats))
    hi_idx = min(int(0.975 * len(stats)), len(stats) - 1)
    return {
        "low": round(stats[lo_idx], 4),
        "high": round(stats[hi_idx], 4),
        "n_resamples_used": len(stats),
        "n_items": n,
    }


cluster_bootstrap_ci = cluster_bootstrap_ci_impl


def exact_mcnemar(b, c):
    n = b + c
    if n == 0:
        return {"b": 0, "c": 0, "n": 0, "p_value": 1.0}
    k = min(b, c)
    p_le_k = sum(math.comb(n, i) for i in range(0, k + 1)) * (0.5 ** n)
    p_value = min(1.0, 2 * p_le_k)
    return {"b": b, "c": c, "n": n, "p_value": round(p_value, 6)}


def gold_filter(data, split, gold_tiers=None):
    ids = []
    for v in data["vignettes"]:
        if split != "all" and v["split"] != split:
            continue
        if gold_tiers is not None and v["gold"] not in gold_tiers:
            continue
        ids.append(v["id"])
    return ids


def metric_values(consensus, vindex, arm, condition, ids, value_fn):
    values = {}
    for vid in ids:
        pred = consensus[vid][arm][condition]["tier"]
        gold = vindex[vid]["gold"]
        v = value_fn(pred, gold)
        if v is not None:
            values[vid] = v
    return values


def paired_contrast(consensus, vindex, arm, condition_a, condition_b, ids, value_fn):
    b = 0
    c = 0
    used = []
    for vid in ids:
        pred_a = consensus[vid][arm][condition_a]["tier"]
        pred_b = consensus[vid][arm][condition_b]["tier"]
        gold = vindex[vid]["gold"]
        va = value_fn(pred_a, gold)
        vb = value_fn(pred_b, gold)
        if va is None or vb is None:
            continue
        used.append(vid)
        if va == 1 and vb == 0:
            b += 1
        elif va == 0 and vb == 1:
            c += 1
    diffs = {}
    for vid in used:
        pred_a = consensus[vid][arm][condition_a]["tier"]
        pred_b = consensus[vid][arm][condition_b]["tier"]
        gold = vindex[vid]["gold"]
        diffs[vid] = value_fn(pred_b, gold) - value_fn(pred_a, gold)
    return {
        "n_pairs": len(used),
        "vignette_ids": used,
        "rate_a": rate([value_fn(consensus[v][arm][condition_a]["tier"], vindex[v]["gold"]) for v in used]),
        "rate_b": rate([value_fn(consensus[v][arm][condition_b]["tier"], vindex[v]["gold"]) for v in used]),
        "mcnemar": exact_mcnemar(b, c),
        "bootstrap_ci_of_difference": cluster_bootstrap_ci(diffs) if diffs else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
    }


def confirmatory_contrast(consensus, vindex, data):
    ids = gold_filter(data, split="test", gold_tiers=["severe"])
    result = paired_contrast(consensus, vindex, "naive", "A", "D", ids, under_triage_value)
    ci = result["bootstrap_ci_of_difference"]
    crosses_zero = ci["low"] is not None and ci["low"] <= 0 <= ci["high"]
    result["gold_tier"] = "severe"
    result["split"] = "test"
    result["stopping_rule_triggered"] = crosses_zero
    return result


def companion_moderate_contrast(consensus, vindex, data):
    ids = gold_filter(data, split="test", gold_tiers=["moderate"])
    result = paired_contrast(consensus, vindex, "naive", "A", "D", ids, under_triage_value)
    result["gold_tier"] = "moderate"
    result["split"] = "test"
    result["label"] = "exploratory"
    return result


def rules_only_catch_rate(consensus, vindex, data, split="test"):
    ids = gold_filter(data, split=split, gold_tiers=["severe"])
    values = {}
    for vid in ids:
        cell = consensus[vid]["rules_only"]["D"]
        values[vid] = 1 if "rule_escalation" in cell["outcomes"] else 0
    return {
        "gold_tier": "severe",
        "split": split,
        "condition": "D",
        "rate": rate(list(values.values())),
        "bootstrap_ci": cluster_bootstrap_ci(values) if values else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
        "n": len(values),
    }


def compute_interaction(consensus, vindex, data, arm1="naive", arm2="full", cond_a="A", cond_d="D", split="all"):
    ids = gold_filter(data, split=split, gold_tiers=UNDER_TRIAGE_GOLD_TIERS)
    per_vignette = {}
    for vid in ids:
        p1a = consensus[vid][arm1][cond_a]["tier"]
        p1d = consensus[vid][arm1][cond_d]["tier"]
        p2a = consensus[vid][arm2][cond_a]["tier"]
        p2d = consensus[vid][arm2][cond_d]["tier"]
        gold = vindex[vid]["gold"]
        vals = [under_triage_value(p, gold) for p in (p1a, p1d, p2a, p2d)]
        if any(v is None for v in vals):
            continue
        v1a, v1d, v2a, v2d = vals
        per_vignette[vid] = (v2d - v2a) - (v1d - v1a)

    n = len(per_vignette)
    point_estimate = rate(list(per_vignette.values())) if per_vignette else None
    ci = cluster_bootstrap_ci(per_vignette) if per_vignette else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0}
    mde = 1.96 * math.sqrt(4 * 0.25 / n) if n > 0 else None
    mde_points = round(mde * 100) if mde is not None else None
    sentence = (
        f"At n={n} this design cannot detect interaction effects below "
        f"roughly {mde_points} points; we report the estimate as exploratory "
        "and do not claim superadditivity."
        if n > 0 else
        "n=0 usable vignettes for this interaction estimate; no statement can be made."
    )
    return {
        "arms": [arm1, arm2],
        "conditions": [cond_a, cond_d],
        "split": split,
        "gold_tiers": UNDER_TRIAGE_GOLD_TIERS,
        "n": n,
        "point_estimate": point_estimate,
        "bootstrap_ci": ci,
        "minimum_detectable_effect_points": mde_points,
        "required_wording": sentence,
        "label": "exploratory_underpowered_no_superadditivity_claim",
    }


def metrics_table(consensus, vindex, data, split):
    table = {}
    for arm in ARMS:
        table[arm] = {}
        for condition in CONDITIONS:
            row = {}
            for gold_tier in UNDER_TRIAGE_GOLD_TIERS:
                ids = gold_filter(data, split=split, gold_tiers=[gold_tier])
                values = metric_values(consensus, vindex, arm, condition, ids, under_triage_value)
                row[f"under_triage_rate_gold_{gold_tier}"] = {
                    "rate": rate(list(values.values())),
                    "n": len(values),
                    "bootstrap_ci": cluster_bootstrap_ci(values) if values else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
                }
            for gold_tier in OVER_TRIAGE_GOLD_TIERS:
                ids = gold_filter(data, split=split, gold_tiers=[gold_tier])
                values = metric_values(consensus, vindex, arm, condition, ids, over_triage_value)
                row[f"over_triage_rate_gold_{gold_tier}"] = {
                    "rate": rate(list(values.values())),
                    "n": len(values),
                    "bootstrap_ci": cluster_bootstrap_ci(values) if values else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
                }
            all_ids = gold_filter(data, split=split)
            signed = metric_values(consensus, vindex, arm, condition, all_ids, signed_error_value)
            row["mean_signed_tier_error"] = {
                "mean": (sum(signed.values()) / len(signed)) if signed else None,
                "n": len(signed),
                "bootstrap_ci": cluster_bootstrap_ci(signed) if signed else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
            }
            exact = metric_values(consensus, vindex, arm, condition, all_ids, exact_match_value)
            row["action_router_accuracy"] = {
                "rate": rate(list(exact.values())),
                "n": len(exact),
                "bootstrap_ci": cluster_bootstrap_ci(exact) if exact else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
                "definition": "predicted tier exactly equals gold tier; assumes the downstream router keys its action off the tier label 1:1, which this eval does not independently verify against scheduler.py",
            }
            outcome_counts = Counter()
            for vid in all_ids:
                for outcome in consensus[vid][arm][condition]["outcomes"]:
                    outcome_counts[outcome] += 1
            row["outcome_counts"] = dict(outcome_counts)
            run_agree = [consensus[vid][arm][condition]["run_to_run_agree"] for vid in all_ids]
            row["run_to_run_agreement_rate"] = rate([1 if a else 0 for a in run_agree]) if run_agree else None
            table[arm][condition] = row
    return table


def noise_floor_a_vs_aprime(consensus, vindex, data, split):
    ids = gold_filter(data, split=split)
    result = {}
    for arm in ARMS:
        diffs = {}
        agree = 0
        n = 0
        for vid in ids:
            pa = consensus[vid][arm]["A"]["tier"]
            pb = consensus[vid][arm]["A_prime"]["tier"]
            if pa is None or pb is None:
                continue
            n += 1
            if pa == pb:
                agree += 1
            diffs[vid] = 0 if pa == pb else 1
        result[arm] = {
            "agreement_rate": (agree / n) if n else None,
            "n": n,
            "bootstrap_ci_of_disagreement_rate": cluster_bootstrap_ci(diffs) if diffs else {"low": None, "high": None, "n_resamples_used": 0, "n_items": 0},
        }
    return result


def print_summary(results):
    print()
    print("CareLoop eval v2: under-triage / over-triage / ordinal error / action-router accuracy")
    print("=" * 88)
    print(f"model: {results['model']}   floating_alias: {results['model_is_floating_alias']}   "
          f"temperature: {results['temperature']}   k: {results['k']}   dry_run: {results['dry_run']}")
    print(f"vignettes: {results['n_total']} total, {results['n_dev']} dev, {results['n_test']} test")
    print()
    cc = results["confirmatory_contrast"]
    print("CONFIRMATORY: naive arm, under-triage rate gold=severe, D vs A, test split only")
    print(f"  rate(A)={cc['rate_a']}  rate(D)={cc['rate_b']}  n_pairs={cc['n_pairs']}")
    print(f"  mcnemar p={cc['mcnemar']['p_value']} (b={cc['mcnemar']['b']}, c={cc['mcnemar']['c']})")
    ci = cc["bootstrap_ci_of_difference"]
    print(f"  bootstrap 95% CI of (D - A): [{ci['low']}, {ci['high']}] over {ci['n_resamples_used']} resamples")
    if cc["stopping_rule_triggered"]:
        print("  STOPPING RULE TRIGGERED: CI crosses zero. Headline is the rules_only catch rate below, not this gap.")
        roc = results["stopping_rule_headline"]
        print(f"  rules_only catch rate, gold=severe, condition D, test: {roc['rate']} (n={roc['n']})")
    else:
        print("  Stopping rule not triggered: CI does not cross zero.")
    print()
    print("EXPLORATORY interaction (naive vs full, D vs A, under-triage, gold severe+moderate pooled, all 24):")
    inter = results["exploratory_interaction_all_24"]
    print(f"  point estimate={inter['point_estimate']}  CI=[{inter['bootstrap_ci']['low']}, {inter['bootstrap_ci']['high']}]  n={inter['n']}")
    print(f"  {inter['required_wording']}")
    print()
    if results["errors_note"]:
        print(results["errors_note"])
    print()


def parse_args():
    parser = argparse.ArgumentParser(description="CareLoop eval v2: under-triage rate, paired stats, bootstrap CIs")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--check-model", action="store_true")
    parser.add_argument("--k", type=int, default=DEFAULT_K)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-output-tokens", type=int, default=400)
    parser.add_argument("--sleep", type=float, default=0.0)
    parser.add_argument("--vignettes", default=str(DEFAULT_VIGNETTES_PATH))
    parser.add_argument("--rubric", default=str(DEFAULT_RUBRIC_PATH))
    parser.add_argument("--out", default=str(DEFAULT_OUT_PATH))
    parser.add_argument("--resamples", type=int, default=DEFAULT_RESAMPLES)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
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
            "GEMINI_API_KEY is not set. Refusing to run the real eval without a "
            "key, and refusing to invent a results file. Use --dry-run."
        )

    data = load_vignettes(args.vignettes)
    rubric_text, rubric_is_real = read_rubric_text(args.rubric, args.dry_run)

    if not args.dry_run and not rubric_is_real:
        raise SystemExit("Refusing a real run with a fallback rubric. This should be unreachable.")

    counter = ApiCallCounter()
    real_caller = None
    if not args.dry_run:
        print(f"Verifying that model '{args.model}' resolves before spending the full budget...")
        if not verify_model_resolves(args.model):
            raise SystemExit(f"Model '{args.model}' does not resolve. Aborting before spending budget.")
        real_caller = build_gemini_caller(args.model, args.temperature, args.max_output_tokens, args.sleep, counter)

    predictions = run_matrix(data, args.k, args.dry_run, rubric_text, real_caller)
    consensus = build_consensus(predictions)
    vindex = vignette_index(data)

    def _ci(values_by_id):
        return cluster_bootstrap_ci_impl(values_by_id, n_resamples=args.resamples, seed=args.seed)

    globals()["cluster_bootstrap_ci"] = _ci

    confirmatory = confirmatory_contrast(consensus, vindex, data)
    companion = companion_moderate_contrast(consensus, vindex, data)
    stopping_rule_headline = rules_only_catch_rate(consensus, vindex, data, split="test")
    interaction = compute_interaction(consensus, vindex, data, split="all")
    interaction_test_only = compute_interaction(consensus, vindex, data, split="test")

    metrics_test = metrics_table(consensus, vindex, data, split="test")
    metrics_dev = metrics_table(consensus, vindex, data, split="dev")
    metrics_all = metrics_table(consensus, vindex, data, split="all")
    noise = noise_floor_a_vs_aprime(consensus, vindex, data, split="all")

    total_parse_failures = 0
    total_refusals = 0
    for vid, by_arm in consensus.items():
        for arm, by_cond in by_arm.items():
            for cond, cell in by_cond.items():
                for outcome in cell["outcomes"]:
                    if "parse_failure" in outcome:
                        total_parse_failures += 1
                    if "refusal" in outcome:
                        total_refusals += 1

    errors_note = None
    if total_parse_failures or total_refusals:
        errors_note = (
            f"{total_parse_failures} parse failure(s) and {total_refusals} refusal(s) "
            "recorded as their own outcome category, not dropped. See outcome_counts per arm/condition."
        )

    is_floating_alias = bool(re.search(r"-latest$", args.model))

    results = {
        "placeholder": False,
        "dry_run": args.dry_run,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "model_is_floating_alias": is_floating_alias,
        "temperature": args.temperature,
        "k": args.k,
        "total_api_calls": counter.count if not args.dry_run else 0,
        "n_total": data["n_total"],
        "n_dev": data["n_dev"],
        "n_test": data["n_test"],
        "vignette_provenance": data["provenance"],
        "conditions": CONDITIONS,
        "arms": ARMS,
        "emergency_scores_as": EMERGENCY_AS_TIER,
        "confirmatory_contrast": confirmatory,
        "companion_moderate_contrast_exploratory": companion,
        "stopping_rule_headline": stopping_rule_headline,
        "exploratory_interaction_all_24": interaction,
        "exploratory_interaction_test_only_16": interaction_test_only,
        "metrics_test": metrics_test,
        "metrics_dev": metrics_dev,
        "metrics_all": metrics_all,
        "noise_floor_a_vs_a_prime": noise,
        "errors_note": errors_note,
        "prompt_versions_scored_against_final_test_set": 1,
        "resamples": args.resamples,
        "bootstrap_seed": args.seed,
        "dialect_representation_limitation": (
            "conditions C and D are author-constructed approximations of dialect "
            "morphosyntax and lexicon, not speech collected from speakers of that "
            "variety; any number broken out by C or D describes the response to "
            "constructed text, not how a real community speaks"
        ),
        "vignette_authorship_limitation": (
            "eval/vignettes.v2.json provenance.human_authored is false; the "
            "vignette texts were generated by the same class of system under "
            "evaluation, not authored by a human or collected from patients"
        ),
    }

    out_path = Path(args.out)
    if args.dry_run:
        out_path = DEFAULT_DRYRUN_OUT_PATH

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        f.write("\n")

    print_summary(results)
    print(f"Wrote {out_path}")

    if not args.dry_run and (total_parse_failures or total_refusals):
        print(f"{total_parse_failures + total_refusals} call(s) did not parse to a tier. Exiting nonzero so this is not missed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
