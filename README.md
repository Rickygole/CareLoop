# CareLoop

> **Not a medical device. Not medical advice.**
> CareLoop is a hackathon research prototype built in 36 hours at HopHacks Fall 2026.
> It is not validated, not clinically tested, and not intended for use in patient care.
> All patient records in this repository are synthetic. No real patient data was used.
> Software that recommends emergency care to patients may constitute a regulated medical
> device under the FDA's Clinical Decision Support framework and under EU MDR. This project
> makes no claim to any regulatory exemption and must not be deployed in a care setting.
> If you are experiencing a medical emergency, call 911. If you are in crisis, call or text 988.

---

This document is written as a compliance and evaluation record for a judged event, not as
marketing copy. Every claim below is either verifiable by reading the cited file and running
the cited command, or is explicitly marked as not yet measured.

## 1. What it does

CareLoop is a prototype medication adherence check-in system. A voice agent calls a patient
to ask whether they took their medication and how they are feeling. A backend service
classifies anything the patient reports into a severity tier so a human care team can be
routed to it appropriately, and separately checks a patient's active medication list against
a small hand-authored table of known interaction pairs. The part of the project this document
is mainly about is not the voice call, it is whether the triage classifier treats a casually
phrased or dialect-varied symptom report the same way it treats the same symptom phrased in
clinical, Standard American English.

### The central claim, and what the run actually returned

The preregistered confirmatory contrast (`eval/PREREGISTRATION.md`, committed before any
result existed) was the difference in under-triage rate on gold-severe vignettes between
condition D, casual register plus constructed dialect features, and condition A, clinical
Standard American English, on the frozen test split, n=8 pairs.

A real run was executed on 2026-09-19: 1,260 API calls, 24 vignettes, 5 conditions, 3 arms,
k=3, temperature 0. The output is committed at `eval/results.v2.json`.

**The result is null.** Under-triage was 0.000 in every arm and every condition, for both
gold-severe and gold-moderate items. The contrast is 0.0 points, paired bootstrap 95% CI
[0.0, 0.0], McNemar p=1.0. We did not measure a register or dialect gap. The stopping rule
written into the preregistration before the run fired automatically.

**Part of the result is adverse to CareLoop, and is reported because it is what the run
returned.** The full pipeline did not beat the naive baseline. On action-router accuracy the
full arm scored 0.625 to 0.750 against the naive arm's 0.792 to 0.875, and it was worst on
condition D, the one the normalization stage was built for. It over-triaged gold-moderate
items at condition D three times as often as naive, 0.75 against 0.25, and its run-to-run
agreement was lower, 0.842 against 0.942.

**The null is about the instrument, not about the world, and the corpus shows why.** Every
severe vignette keeps its clinical red-flag wording verbatim across all five conditions.
"Crushing pressure in the middle of my chest that is going down my left arm" appears in the
clinical condition; the dialect condition is the same sentence with the copula deleted. The
manipulation varied grammar and never varied clinical content, and by content-word overlap it
perturbs less than the paraphrase control that was supposed to calibrate it. Under-triage
was pinned at zero because the design could not produce anything else. At n=8 pairs the
confirmatory test cannot reach significance below a 75-point gap, and its power against a
50-point gap is roughly 15 percent.

**No claim of reduced under-triage, a closed gap, or an improvement over a baseline is made
anywhere in this project.**

The paraphrase noise floor, condition A against condition A-prime, is 8.3 percent for the
naive arm and 12.5 percent for the full arm. Most differences between conditions are at or
below that, which means they are not differences.

`eval/results.json` is the output of the retired v1 methodology (paraphrase invariance, no
gold labels, see `eval/archive/README.md`). It is not compatible with the claim above and
should not be read as evidence for it.

### The two-tier architecture

Symptom triage in `triage_engine.py` runs in two tiers:

1. **Tier 0, deterministic.** A table of regular expressions checks the patient's (normalized)
   transcript against unambiguous emergency phrasing: chest pain, breathing difficulty, loss
   of consciousness, severe bleeding, stroke signs, suicidal ideation, overdose, and more,
   including informal, dialectal, and Spanish-language phrasing. No network call, no model, no
   ambiguity. A match sets severity to EMERGENCY immediately.
2. **Tier 1, a language model.** Anything Tier 0 does not catch is passed to a Gemini
   classifier, which returns MILD, MODERATE, or SEVERE.

The final severity is `max(tier_0_floor, tier_1_result)`. When Tier 0 finds nothing, the floor
is the lowest severity and Tier 1 has its full range. When Tier 0 fires, Tier 1 is never
consulted, so there is no path by which a model call can talk an emergency down. If the Tier 1
classifier is unreachable or returns something unparseable, the result fails toward
**MODERATE**, not MILD.

See Section 6, "Safety design," for the crisis-handling behavior, and `docs/AGENT_CONFIG.md`
for the exact voice agent script that reads a triage result back to a patient.

## 2. Limitations

- **Synthetic vignettes, not real patient reports.** Every symptom description scored by the
  evaluation is a constructed sentence, not something a real patient said.
- **Small n.** 24 vignettes total, 16 on the frozen test split. See `eval/README.md`,
  "What this does not show," for the effect size this can and cannot detect.
- **Single ASR system, if any.** The current evaluation does not run ASR at all (see below);
  a future audio pass would exercise exactly one speech recognition system, not a
  representative sample of them.
- **Non-clinician gold labels.** Gold tiers are the project team's own application of a
  documented protocol rule (`docs/TIER_RUBRIC.md`), not a clinician's independent judgment,
  and the team is not independent of the corpus it labeled.
- **Single site.** One team, one build window, one model family.

Two further limitations matter more than the five above and are stated here without
softening:

- **The vignettes were not written by a human.** `eval/vignettes.v2.json` carries its own
  `provenance` field, and it says so directly: `"human_authored": false`, `"authored_by":
  "generated by the same class of language model that is under evaluation"`. The corpus this
  evaluation's gold labels are attached to was generated by the same class of system being
  evaluated, not collected from patients and not hand-written by the team as originally
  planned. Read every number this evaluation produces with that in mind.
- **The dialect conditions are author-constructed approximations, not speech from speakers of
  that variety.** Conditions `C` and `D` in the corpus approximate dialect morphosyntax and
  lexicon (dropped copula, habitual "be," multiple negation, and similar features) as
  constructed text. No recording or transcript from an actual speaker of that variety was
  used. This is a limitation about **who is represented** in this evaluation, not only about
  acoustics: treating a good result on condition `D` as evidence that the product serves that
  dialect community well would be a larger claim than this evaluation can support, no matter
  how the numbers land.

**The current evaluation is text only.** It does not synthesize speech and it does not run
automatic speech recognition, even though CareLoop's actual intake is a phone call (speech in,
ASR transcript out, then the text pipeline this evaluation tests). Because of that, this
evaluation cannot see whether automatic speech recognition error rates differ by dialect, in
either direction: a real audio pass could show the disparity is worse than the text-only
numbers suggest, better, or roughly canceled out, and this harness has no way to tell which.
Building a TTS-to-ASR pass was judged not achievable before code freeze in this build window.
It is scoped as future work, not attempted here, and is documented in more detail under "What
was not built: TTS/ASR modality pass" in `eval/README.md`.

## 3. Prior work and provenance

The first commit in this repository's history is timestamped `2026-09-18 23:25:15 -0400`
(`git log --reverse` on the `main` branch). The interaction table in `contradiction.py` and
the vignette corpus in `eval/vignettes.v2.json` were both authored during this same hacking
window, after that first commit, not carried over from an earlier project. No code, data,
prompts, or tables in this repository were reused from any prior work by this team or anyone
else.

## 4. Assistance disclosure

This build was substantially produced with AI coding assistance. The specification, the
direction of the project, the review of every change, and every decision about what to build,
what to cut, and what to disclose were the team's own. Where assistance produced code, data
scaffolding, or prose, a human on the team reviewed it before it was committed and is
accountable for it. This document intentionally does not name any specific vendor or tool;
the disclosure is about the fact and extent of assistance, not an endorsement of a product.

## 5. Synthetic data statement

All patient records in this repository (`mock_data/patients.json`) are fabricated for this
demonstration. No real patient data was used anywhere in this project. The identifier boundary
in this stack (patient IDs, phone numbers, and the shared webhook secret gating `/trace` and
`/webhook/elevenlabs`) is demo-grade access control, not a legal safeguard: it is not a
Business Associate Agreement, and no provider in this stack (Gemini, ElevenLabs, Backboard,
or the hosting platforms in `docs/DEPLOY.md`) is covered under one. Do not send real patient
information through this system.

## 6. Safety design

- **A deterministic rule layer the model cannot override downward.** Tier 0 in
  `triage_engine.py` is a regex table with no model in the loop. The combined result is
  `max(tier_0_floor, tier_1_result)`: a language model can raise a severity Tier 0 did not
  catch, but once Tier 0 has matched, Tier 1 is never even called, so there is no path by
  which a model call can talk a matched emergency down.
- **A crisis path that bypasses tiering and does not end the call.** Suicidal ideation and
  overdose disclosures are Tier 0 rules (`CRISIS_RULES` in `triage_engine.py`), so like every
  other Tier 0 match they skip the Tier 1 model call entirely and resolve deterministically.
  The API marks these with a separate `is_crisis` flag alongside the EMERGENCY severity. The
  agent instructions in `docs/AGENT_CONFIG.md` require that a crisis call route to 988 (call
  or text), stay on the line, and never be cut short or handed to 911 and hung up. This is a
  response-design requirement enforced in the agent script and the suggested response text in
  `responses.py`. Exclusion from replay is also enforced in code: `memory.py` stores a crisis
  episode but filters it out of `get_history`, so a later call never repeats a disclosure back
  to the patient. The episode is retained on disk for audit. There is a test asserting both
  halves, that it is excluded from replay and that it is still on disk.
- **Booking is refused on emergency and crisis by design.** `/loop/run` only attempts to book
  a follow-up when the tier is moderate or severe and the result is not an emergency; an
  EMERGENCY severity (crisis included, since crisis carries the same severity) never reaches
  the booking path. `docs/AGENT_CONFIG.md` separately instructs the agent to never call
  `book_appointment` on an emergency call.
- **The system never contacts emergency services on a patient's behalf.** Nothing in this
  codebase places an outbound call to 911 or any emergency dispatcher. The mock patient
  records in `mock_data/patients.json` do not carry a home address, and there is no consent
  flow for CareLoop to act on a patient's behalf with a third party. The agent's job on a
  medical emergency is to tell the patient to call 911 themselves and to alert their care
  team, not to place that call for them.
- **What this system explicitly does not handle:** pediatric patients, pregnancy, cognitive
  impairment, or a caregiver answering the phone instead of the patient. There is no age,
  pregnancy, or cognitive-status field anywhere in the patient data model, no branch in the
  agent script for confirming who is actually on the line, and no distinct handling if the
  person speaking is not the patient. Treat any call in one of these situations as outside
  this prototype's scope, not as a case it has been tested against.

## 7. Reproduction

The evaluation harness is the reproducible artifact this document is about. Its real command,
options, and output files are documented in `eval/README.md`; the command below is copied from
there, not invented for this file:

```
/Users/rickygole/Careloop/CareLoop/.venv/bin/python eval/score_v2.py
```

This requires `GEMINI_API_KEY` to be set. It verifies the pinned model resolves before
spending the call budget, refuses to run if `docs/TIER_RUBRIC.md` is missing, and writes
`eval/results.v2.json`. To run the entire pipeline with zero API calls (rule layer real,
classifier and normalizer replaced with a deterministic offline fake), use
`eval/score_v2.py --dry-run` instead, per `eval/README.md`.

Fixed constants for reproducibility: the model id is pinned to `DEFAULT_MODEL` in
`triage_engine.py`, currently `gemini-flash-lite-latest` (overridable with `--model` or the
`GEMINI_MODEL` environment variable); `k=3` full repeats per condition per arm at
`temperature=0.0`; the bootstrap CI uses `--resamples 10000` and a fixed `--seed 20260919`, so
the same committed vignette file and the same real API responses reproduce the same interval.
Temperature 0 is not determinism, which is why `run_to_run_agreement_rate` is reported
per arm and condition rather than assumed to be 1.0.

## 8. Dependency and license note

The interaction rows in `contradiction.py` (`INTERACTION_PAIRS`) were hand written for this
project, not extracted or copied from a licensed drug interaction database. Each row carries
its own `source` field citing the FDA label section it was drawn from (for example, `"FDA
label, Coumadin, Drug Interactions"`), so provenance for any given row is checkable against
that label rather than taken on faith. The table's own `LIMITATIONS` string, defined in the
same file, says plainly what it is not: not a formulary check, not ingredient-normalized, and
not a substitute for a maintained clinical interaction database. Treat it as a small,
hand-curated demonstration table, nothing more.

## 9. Division of labour

Placeholder, to be filled in by name before submission. Nobody has been assigned below yet.

| Area | Owner |
|---|---|
| Triage engine and safety floor (`triage_engine.py`, `responses.py`) | TBD |
| Backend API and event trace (`main.py`, `scheduler.py`, `clinic.py`, `providers.py`) | TBD |
| Regimen / interaction check (`contradiction.py`) | TBD |
| Frontend (`frontend/`) | TBD |
| Evaluation methodology and harness (`eval/`) | TBD |
| Voice agent configuration (`docs/AGENT_CONFIG.md`) | TBD |
| Documentation and this file | TBD |

## Running it locally

Requires Python 3.9+.

```bash
git clone https://github.com/Rickygole/CareLoop.git
cd CareLoop
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python check_env.py
uvicorn main:app --reload
```

On Windows, activate the virtual environment with `.venv\Scripts\activate` instead. In
`.env`, fill in `GEMINI_API_KEY` to enable Tier 1 (Tier 0 emergency detection works with no
keys at all); fill in `CARELOOP_WEBHOOK_SECRET` to require a shared secret on the trace stream
and the voice agent webhook, or leave it blank for local development. `python check_env.py`
confirms which keys are present without ever printing a value.

The API is now at `http://localhost:8000`. `GET /health` confirms it is up and whether Tier 1
has a Gemini key configured.

### Frontend

`frontend/` is a Vite plus React judge console. It is actively being restructured into five
screens covering one check-in flow: connect to a patient, review their medications, run the
call, see the triage decision, and review the supporting evidence. As of this writing that
restructure is mid-flight in the source tree (some of the new screens referenced from the
router are not yet present as files), so this document describes the flow rather than a fixed
set of URLs that may still change. Check `frontend/src/App.jsx` and `frontend/src/pages/` for
the current, ground-truth state of the routing before relying on a specific path. The frontend
talks to the backend over a single `VITE_API_BASE` environment variable, defaulting to
`http://localhost:8000`. See `frontend/README.md` for the frontend's own run instructions and
environment variables, and `docs/DEPLOY.md` for how the frontend and backend are hosted
separately in production and why.

```bash
cd frontend
npm install
npm run dev
```

## API surface

All routes are served by `main.py`; every clinical decision lives in `triage_engine.py`,
which has no dependency on FastAPI and can be unit tested standalone.

| Route | Method | Purpose |
|---|---|---|
| `/portal/connect` | POST | Look up a patient and derive their dosing schedule from their medication requests. |
| `/triage` | POST | Classify a transcript into a severity tier and get the suggested spoken response. |
| `/book` | POST | Book a follow-up appointment against the static provider registry. Refuses when the specialty has no open slots (the emergency path never has any). |
| `/webhook/elevenlabs` | POST | Tool-call receiver for the voice agent (`report_symptom`, `book_appointment`). Shared-secret gated. |
| `/trace` | WebSocket | Live structured event log for the judge console. Shared-secret gated. |
| `/trace/events` | GET | Polling fallback for `/trace` on hosts that cannot hold a WebSocket open. |
| `/loop/run` | POST | Runs a full simulated check-in for a patient (reminder, triage, optional clinic booking) and returns every trace event it produced. |
| `/schedule/{patient_id}` | GET | The patient's derived dosing schedule for the day. |
| `/regimen/{patient_id}` | GET | The patient's medications, schedule, and the current interaction-check findings from `contradiction.py`. |
| `/meds` | POST | Add a medication to a patient's active list and re-run the interaction check and schedule. |
| `/admin/reset` | POST | Resets the in-memory trace bus, for a clean demo run. |
| `/health` | GET | Liveness and configuration check. |

Full request/response shapes for the voice agent's two tools, including the exact JSON schema
to paste into the ElevenLabs dashboard, are documented in `docs/AGENT_CONFIG.md`.

## Running the tests

```bash
pytest
```

208 tests, all offline: 107 exercise the triage engine directly (`tests/test_triage.py`), 57
lock the frozen HTTP contract that the frontend and the voice agent are both built against
(`tests/test_api.py`), 36 measure emergency coverage against an adversarial corpus and its
false-positive guards (`tests/test_emergency_coverage.py`), and 8 guard the evaluation's own
integrity, refusing to let a chart ship numbers that do not trace back to a real, committed
run (`tests/test_eval_integrity.py`). The
Tier 1 classifier is injected as a fake everywhere it is exercised in `tests/`, so nothing
touches the network or requires an API key. The suite is the primary evidence for the "never
downgrade" safety property: it asserts that an emergency phrase reaches EMERGENCY even when
the injected Tier 1 classifier insists on MILD, that Tier 1 is never even invoked once Tier 0
has matched, and that a crisis response never contains "911" while an emergency response
always does.

## Project layout

```
main.py            FastAPI app: routes, trace event bus, webhook, demo loop runner.
triage_engine.py   The two-tier triage engine. Framework-free, unit testable alone.
contradiction.py   Hand-authored medication interaction table and the regimen check.
responses.py       Static, non-LLM-generated lines the agent reads back per tier.
providers.py       Static provider registry, specialty/payer matching, booking.
clinic.py          Simulated clinic front-desk script for the demo booking flow.
scheduler.py       Derives a patient's day plan and dosing schedule.
mock_data/         Synthetic FHIR-shaped patient records. Not real patient data.
tests/             pytest suite: triage engine, the frozen HTTP contract, and eval integrity.
check_env.py       Confirms which .env keys are present without printing values.
frontend/          Vite plus React judge console, mid-restructure. See frontend/README.md.
eval/              The v2 evaluation harness, corpus, preregistration, and results.
.do/app.yaml       DigitalOcean App Platform spec for the backend.
Procfile           Alternate process entry point for Procfile-based hosts.
runtime.txt        Pinned Python runtime for hosts that read it.
docs/PLAN.md           The build plan and the reasoning behind every safety decision.
docs/TIER_RUBRIC.md    The operational tier definitions the classifier and gold labels share.
docs/AGENT_CONFIG.md   How to hand-configure the ElevenLabs voice agent.
docs/DEMO_SCRIPT.md    The rehearsed demo script for the judged event.
docs/DEPLOY.md         How the backend and frontend are hosted, and why they are split.
```

## What CareLoop does not claim

CareLoop does not diagnose anything. It is not clinically validated. It is not FDA compliant.
It is not HIPAA compliant. It is not guaranteed safe or accurate. It does not replace a nurse
line. It does not reduce ER visits. It has not been tested on real patients or real patient
speech.

Two narrower claims are made, and they are about internal behavior only.

The first is structural: Tier 0 is deterministic by construction, so the same transcript
always produces the same result and a model is never consulted on a matched emergency. That
is verifiable by reading `triage_engine.py` and running `pytest`.

The second is a measured coverage figure, not an improvement claim: on a 25-phrase
adversarial corpus of improvised emergency wordings, the rule layer matches 23, and on a
16-phrase guard corpus of negations, past tense, hypotheticals and chronic baseline symptoms
it matches none. Both corpora are in `tests/test_emergency_coverage.py` and both numbers are
asserted there. Two phrasings remain uncaught and are named in that file rather than omitted.
Typo tolerance is narrow and deliberate: three specific misspellings are covered and general
misspelling is not.

The claim this document previously reserved, a measured fairness or safety improvement, is
withdrawn. The committed run returned a null result on the preregistered contrast and an
adverse result on pipeline accuracy. See Section 1.

## License

MIT. See `LICENSE`.
