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

## What this is

CareLoop is a prototype medication adherence check-in system. A voice agent
calls a patient to ask whether they took their medication and how they are
feeling, and a backend service classifies anything the patient reports so a
human care team can be routed to it appropriately. The interesting part of
this project is not the voice call, it is the triage engine behind it: a
deterministic safety floor that a language model is allowed to raise but
never lower.

This is a demonstration built for a judged event. It is not a product.

## The two-tier architecture

Symptom triage in `triage_engine.py` runs in two tiers:

1. **Tier 0, deterministic.** A table of regular expressions checks the
   patient's (normalized) transcript against unambiguous emergency
   phrasing: chest pain, breathing difficulty, loss of consciousness,
   severe bleeding, stroke signs, suicidal ideation, and more, including
   informal, dialectal, and Spanish-language phrasing. No network call, no
   model, no ambiguity. If it matches, the result is EMERGENCY immediately.
2. **Tier 1, a language model.** Anything Tier 0 does not catch is passed
   to a Gemini classifier, which returns MILD, MODERATE, or SEVERE.

The safety property the whole design exists to guarantee:

> **The language model can only raise severity. It can never lower it.**

The final severity is `max(tier_0_floor, tier_1_result)`. When Tier 0 finds
nothing, the floor is the lowest severity and Tier 1 has its full range.
When Tier 0 fires, Tier 1 is not even consulted, so there is no path by
which a model call can talk an emergency down. This is why the floor is
deterministic rather than learned: a regex either matches or it does not,
and that behavior can be unit tested exhaustively, which `tests/test_triage.py`
does (70 cases, including macOS smart-apostrophe variants, negation,
historical mentions, and Spanish phrasing).

If the Tier 1 classifier is unreachable or returns something unparseable,
the result fails toward **MODERATE**, not MILD. An unreachable classifier
that silently marks everything mild is a worse failure than one that
over-flags for human review.

### Crisis handling is a response decision, not a triage decision

A disclosure of suicidal ideation or overdose is still classified as
EMERGENCY severity (it should get attention immediately), but the response
differs on purpose from a medical emergency. The API returns an `is_crisis`
boolean alongside `tier`. On a medical emergency the voice agent directs the
patient to 911 and alerts the care team. On a crisis, the agent does not
call 911 and does not end the call: it offers 988 (call or text) and stays
on the line. Routing a suicidal caller to police and then hanging up is
contraindicated by most crisis guidance, so CareLoop deliberately does not
treat a mental health crisis like a cardiac event. See `responses.py` and
`docs/PLAN.md` section 0.2.

## Running it locally

Requires Python 3.9+.

```bash
git clone https://github.com/Rickygole/CareLoop.git
cd CareLoop
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# fill in GEMINI_API_KEY to enable Tier 1 (optional -- Tier 0 emergency
# detection works with no keys at all). Fill in CARELOOP_WEBHOOK_SECRET
# to require a shared secret on the trace stream and the voice agent
# webhook; leave it blank for local development.

python check_env.py     # confirms which keys are present, never prints values
uvicorn main:app --reload
```

The API is now at `http://localhost:8000`. `GET /health` confirms it is up
and whether Tier 1 has a Gemini key configured.

Tier 0 emergency detection requires no API keys and no network access.
Tier 1 (mild/moderate/severe classification) requires `GEMINI_API_KEY`; if
it is unset or the request fails, the engine fails toward MODERATE rather
than guessing MILD. `GEMINI_MODEL` optionally overrides the model id.

### Frontend

`frontend/` is a Vite plus React judge console (trace panel and dashboard),
in progress at the time of writing. It talks to the backend over a single
`VITE_API_BASE` environment variable, defaulting to `http://localhost:8000`
so a fresh clone points at a local backend with no extra configuration.
Once it is complete:

```bash
cd frontend
npm install
npm run dev
```

See `docs/DEPLOY.md` for how the frontend and backend are hosted separately
in production and why.

## API surface

All routes are served by `main.py`; every clinical decision lives in
`triage_engine.py`, which has no dependency on FastAPI and can be
unit tested standalone.

| Route | Method | Purpose |
|---|---|---|
| `/portal/connect` | POST | Look up a patient and derive their dosing schedule from their medication requests. |
| `/triage` | POST | Classify a transcript into a severity tier and get the suggested spoken response. |
| `/book` | POST | Book a follow-up appointment against the static provider registry. |
| `/webhook/elevenlabs` | POST | Tool-call receiver for the voice agent (`report_symptom`, `book_appointment`). Shared-secret gated. |
| `/trace` | WebSocket | Live structured event log for the judge console. Shared-secret gated. |
| `/trace/events` | GET | Polling fallback for `/trace` on hosts that cannot hold a WebSocket open. |
| `/health` | GET | Liveness and configuration check. |

Full request/response shapes for the voice agent's two tools, including the
exact JSON schema to paste into the ElevenLabs dashboard, are documented in
`docs/AGENT_CONFIG.md`.

## Running the tests

```bash
pytest
```

90 tests, all offline: 70 exercise the triage engine directly
(`tests/test_triage.py`), and 20 lock the frozen HTTP contract that the
frontend and the voice agent are both built against (`tests/test_api.py`),
so a silent change to a response shape fails loudly instead of breaking a
consumer nobody can see failing. The Tier 1 classifier is injected as a
fake everywhere it is exercised, so nothing touches the network or
requires an API key. The suite is the primary evidence for the "never
downgrade" safety property: it asserts that an emergency phrase reaches
EMERGENCY even when the injected Tier 1 classifier insists on MILD, that
Tier 1 is never even invoked once Tier 0 has matched, and that a crisis
response never contains "911" while an emergency response always does.

## Project layout

```
main.py            FastAPI app: routes, trace event bus, webhook. No clinical logic.
triage_engine.py   The two-tier triage engine. Framework-free, unit testable alone.
responses.py       Static, non-LLM-generated lines the agent reads back per tier.
providers.py       Static provider registry, specialty/payer matching, booking.
mock_data/         Synthetic FHIR-shaped patient records. Not real patient data.
tests/             pytest suite: triage engine (test_triage.py) and the
                   frozen HTTP contract (test_api.py).
check_env.py       Confirms which .env keys are present without printing values.
frontend/          Vite plus React judge console. In progress.
.do/app.yaml       DigitalOcean App Platform spec for the backend.
Procfile           Alternate process entry point for Procfile-based hosts.
runtime.txt        Pinned Python runtime for hosts that read it.
docs/PLAN.md       The build plan and the reasoning behind every safety decision.
docs/AGENT_CONFIG.md   How to hand-configure the ElevenLabs voice agent.
docs/DEMO_SCRIPT.md    The rehearsed demo script for the judged event.
docs/DEPLOY.md         How the backend and frontend are hosted, and why they are split.
```

## Pre-existing work: none

All code in this repository was written during the HopHacks Fall 2026
hacking window (Fri 21:00 EDT to Sun 09:00 EDT). No prior codebase was
reused.

## What CareLoop does not claim

CareLoop does not diagnose anything. It is not clinically validated. It is
not FDA compliant. It is not HIPAA compliant. It is not guaranteed safe or
accurate. It does not replace a nurse line. It does not reduce ER visits.
It has not been tested on real patients or real patient speech. The only
claim this project makes is about its own internal behavior: given the
inputs described in `docs/PLAN.md` section 4, the deterministic Tier 0
layer classifies consistently regardless of how a symptom is phrased,
across a small, non-clinical, team-authored evaluation set. See
`docs/PLAN.md` section 4 for the evaluation methodology and its limits, and
section 5 for the full regulatory reasoning behind these disclaimers.

## License

MIT. See `LICENSE`.
