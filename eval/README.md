# CareLoop eval: paraphrase invariance

## What this measures

This eval does not use ground truth severity labels. It does not ask "did the
classifier get the right answer." It asks a narrower, checkable question:

> For the same underlying symptom, described in four different registers,
> does the classifier return the same tier every time?

If the classifier is invariant to phrasing, the tier a patient gets should
depend only on what they are describing, not on how they talk. If it is not
invariant, then whatever the "correct" tier is, some patients are getting a
different answer than others for reporting the identical symptom, purely
because of vocabulary, formality, hedging, or language mixing. That is a
measurable, ground-truth-free way to demonstrate a phrasing bias (or the
absence of one) without the team ever having to assert what the correct
answer was.

This design was chosen instead of an "under-triage rate" eval with
hand-labeled correct answers. That alternative was considered and rejected:
with a handful of hand-authored cases, the smallest possible change in the
result is large (double digit percentage points), and because the team would
be authoring the cases, the labels, and the baseline, the result is
circular. Paraphrase invariance needs no labels, so there is nothing to
accuse of circularity. The result is not "CareLoop under-triages less often
than a naive pipeline." The result is "whatever the correct answer is, the
naive pipeline gives a different one depending on how the patient talks, and
this one does not" (or: "does too," if that is what the data shows).

## What this does not show

- It does not show that any tier assigned is clinically correct. No clinician
  reviewed these scenarios or labeled them.
- It is not a measurement of real-world bias, dialect fairness, or language
  fairness. Every scenario and paraphrase in `cases.json` was written by the
  CareLoop project team, not collected from real patients, and is not a
  representative sample of any population, dialect, age group, or language
  community. See the `note` field at the top of `cases.json`, which is
  intended to be shown or quoted whenever this eval's results are shown.
- With 9 scenarios, the sample is small. Treat percentages as a demonstration
  of the method and a directional signal, not a precise measurement.
- "mixed_language" paraphrases are the team's own attempt at Spanish/English
  code-mixing, not a linguist-reviewed or native-speaker-reviewed sample.

## The three arms

All three arms use the same model, the same temperature, and the same
underlying severity rubric (mild / moderate / severe, as defined in
`triage_engine.TIER1_PROMPT`). The only thing that differs between arms is
what the classifier is asked to do with the transcript before it answers.

- `naive`: the raw transcript goes straight into the rubric. One call. One
  word back (MILD, MODERATE, or SEVERE). This is what a classifier looks
  like with no normalization and no intermediate reasoning step at all.
- `cot`: one call. The model is asked to restate the transcript in one or
  two sentences of clinical terminology, then classify that restatement.
  This is a chain-of-thought-style call: it adds a reasoning step, but the
  instruction is just "put this in clinical terms," not "strip out register
  and produce a canonical phrasing." It returns a small ordered JSON object:
  `clinical_restatement` first, then `tier`.
- `normalize`: one call, using the exact prompt CareLoop ships in
  `triage_engine.TIER1_PROMPT`. The model is asked to produce
  `normalized_text`, a register-neutral clinical restatement that strips
  casual tone, hedging, minimization, regional idiom, and non-English
  phrasing, before classifying that normalized text. Same ordered JSON
  shape as `cot`, with `normalized_text` in place of `clinical_restatement`.

`cot` and `normalize` are structurally identical: same call count, same
number of output fields, same JSON ordering (the extra field always comes
before `tier`, so the tier is causally conditioned on it). The only thing
that differs between them is the content of the instruction: "restate
clinically" versus "normalize away the register." That is deliberate. If
`normalize` is more consistent than `naive`, that alone does not tell you
whether the improvement came from normalization or from simply giving the
model one more step to think before answering. `cot` is the control that
isolates the two: if `cot` looks like `naive` and `normalize` looks better
than both, the improvement is attributable to normalization specifically,
not to inference count. If `cot` and `normalize` look similar, the extra
reasoning step is doing the work, not the register-stripping.

`normalize` reuses `triage_engine.TIER1_PROMPT` directly (imported, not
copied), so this arm is always testing the literal prompt CareLoop ships,
not a reconstruction of it that could drift out of sync. `naive` and `cot`
use prompts local to `score.py` that mirror the same mild/moderate/severe
rubric text. If `triage_engine.TIER1_PROMPT`'s rubric wording changes in a
way that would materially change how a model reads it, update the `RUBRIC`
constant in `score.py` to match, so the three arms stay comparable.

## Metrics

For every (scenario, arm, register), the case is run `--repeats` times
(default 5). The modal (most common) tier across those repeats is that
register's answer; ties break toward the more severe tier, matching
CareLoop's own stated philosophy of failing toward attention rather than
away from it. The spread across repeats (how many of the 5 runs agreed) is
recorded per register in `scenario_detail` so silent instability is visible
even when the modal answer looks fine.

Primary metric, consistency: for each scenario, look at all six pairs among
the four registers' modal tiers, and take the fraction of pairs that match.
Average across scenarios for that arm's overall consistency percentage. Per
register percentages (the numbers the frontend chart reads) are computed
differently: for each register, across all nine scenarios, the percentage of
scenarios where that register's modal tier agrees with the scenario's own
majority tier across all four registers. This is still ground-truth-free:
the "majority" is majority-of-the-four-paraphrases, not an external label.
It answers "does phrasing register X tend to be the odd one out."

Secondary metric, directionality: whenever a register disagrees with its
scenario's majority, record whether it landed lower or higher in severity
than the majority. The hypothesis this is designed to catch is
under-triage: a naive pipeline reading a hedged, minimized, or
code-switched description as less severe than the same symptom described
clinically. If it goes the other way (normalization over-triaging by
discarding hedging language), report that too. Both are legitimate,
reportable findings; a negative or backwards result is still a result.

## Running it

Everything runs through `eval/score.py` using the project's venv:

```
/Users/rickygole/Careloop/CareLoop/.venv/bin/python eval/score.py --dry-run
```

`--dry-run` never touches the network and never requires `GEMINI_API_KEY`.
It runs the full pipeline (load cases, validate them against Tier 0, run all
three arms across all nine scenarios and four registers, aggregate, print
the summary table) against a deterministic offline fake classifier, so the
plumbing can be exercised and reviewed with no key present. It writes its
output to `eval/results.dryrun.json`, never to `eval/results.json`, and
marks `"placeholder": true` and `"dry_run": true` so a dry run can never be
mistaken for a real measurement. `eval/results.dryrun.json` is gitignored.

Once `GEMINI_API_KEY` is set (in `.env` or the environment):

```
/Users/rickygole/Careloop/CareLoop/.venv/bin/python eval/score.py
```

This will:

1. Load and validate `eval/cases.json`. Every paraphrase is checked against
   `triage_engine.detect_emergency` (Tier 0). If any paraphrase trips a Tier
   0 rule, the run aborts loudly: a paraphrase that Tier 0 catches is not a
   Tier 1 case, and including it would make the arms comparison meaningless
   (Tier 0 is deterministic regex, so all three arms would trivially agree).
2. Make one lightweight call to confirm the pinned model id resolves on the
   installed SDK before spending the full call budget. If it does not
   resolve, the run aborts with the SDK's own exception message printed, and
   nothing is written.
3. Run all three arms across all nine scenarios and four registers, five
   times each by default: 9 x 3 x 4 x 5 = 540 calls at the defaults.
4. Print the summary table to stdout.
5. Write `eval/results.json` with `"placeholder": false`.

If any individual call fails to return a parseable tier, that call is
recorded in `errors` in the results file (never silently dropped, never
guessed), and the process exits nonzero at the end so a partially-broken run
is never mistaken for a clean one.

Useful flags:

- `--repeats N` (default 5)
- `--temperature X` (default 0.0, matching `triage_engine`'s production
  default; override to test whether findings hold at higher temperature)
- `--model NAME` (default: whatever `triage_engine.DEFAULT_MODEL` is
  currently pinned to, or `GEMINI_MODEL` if set; override here to test a
  different model without touching production)
- `--check-model` runs only the model-resolution probe and exits, useful for
  a fast check the moment a key lands, without spending the full budget
- `--sleep X` seconds between calls, if rate limited
- `--out PATH` where to write results (ignored in `--dry-run`, which always
  writes to `eval/results.dryrun.json`)

Per the plan, the intent is to run this once for real, commit the resulting
`eval/results.json`, and have the frontend chart read the committed file
rather than calling the model live.

## Known issue: the pinned model id is unverified

`triage_engine.py` pins `gemini-3.6-flash` as `DEFAULT_MODEL`, overridable
with `GEMINI_MODEL` in `.env`.

This was verified against the live API on 2026-09-19, and the original
pin was wrong. `gemini-1.5-flash` is retired and returns:

    NotFound: 404 models/gemini-1.5-flash is not found for API version
    v1beta, or is not supported for generateContent

`gemini-2.5-flash` is also gone for new keys, and the API names its own
replacement in the error text:

    NotFound: 404 This model models/gemini-2.5-flash is no longer
    available to new users. Please update your code to use
    models/gemini-3.6-flash

Two traps worth knowing, both of which cost real time here:

`genai.list_models()` lists models that a new key cannot actually call.
It is not a reliable availability check. The only reliable check is
issuing a real `generateContent` call, which is what `--check-model`
does.

An empty environment variable is not an absent one. `GEMINI_MODEL=` with
no value made `os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)` return the
empty string rather than the default, and the model name resolved to
`''`. Both this file's loader and `triage_engine` now use
`os.environ.get(...) or DEFAULT_MODEL`.
