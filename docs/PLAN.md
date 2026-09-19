# CareLoop Build Plan v2

Revised after adversarial review. This supersedes the v1 handoff document.
Every change below is a decision, not a suggestion. Where v1 said something
different, v2 wins, and the reason is stated.

Clock: hacking opened Fri 21:00 EDT. Submission Sun 09:00 EDT.
Treat 08:30 Sun as the real deadline. No commits after it.

---

## 0. What changed and why

Five independent reviews were run against v1. Four findings were severe
enough to change the build, and all four were reproduced against running
code before being accepted.

### 0.1 Tier 0 was broken in ways a judge would find by typing

Verified by direct execution, not inspection:

| Input | v1 behavior | Now |
|---|---|---|
| `I can't breathe` with a macOS smart apostrophe | MILD, "log it and continue" | EMERGENCY |
| `no chest pain today` | EMERGENCY, call 911 | not escalated |
| `I want to die` | MILD | EMERGENCY, crisis route |
| `tengo dolor en el pecho` | MILD | EMERGENCY |
| `my husband is grey and not responding` | MILD | EMERGENCY |
| v1's own B.1 patterns vs v1's own B.5 transcripts | 3 of 6 missed | 6 of 6 caught |

The smart apostrophe one is the important one. macOS converts a typed
apostrophe to U+2019 by default. A judge typing "I can't breathe" into the
console on the presenter's MacBook produced MILD. One character separated a
911 handoff from "log the response and continue the normal check-in cadence",
while the presenter was claiming the layer is deterministic and cannot be
overridden downward.

Fixed. Input is normalized before any pattern runs. Matches are scoped
against surrounding context so negation and history do not escalate.
Test count went from 36 to 70, and the new tests are the spec's own
mandated transcripts plus the adversarial set, rather than strings written
to match the patterns.

### 0.2 A suicide disclosure was routed like a heart attack

v1 returned "call 911 and page the on-call clinician" for suicidal ideation,
and F.1 step 4 told the agent to end the call. Directing a suicidal caller
to police and then hanging up is contraindicated by most crisis guidance and
is the most criticized failure mode in AI mental health.

Crisis now carries the same EMERGENCY severity floor but a separate action:
warm handoff to 988, stay on the line. This is a response change, not a
triage change. It is also a strong demo moment: "we deliberately do not
treat a crisis like a cardiac event."

### 0.3 The fairness claim as written does not survive a clinician judge

Three structural problems, all fatal in front of the right judge:

1. n=6 per cell means the smallest possible change in any bar is 16.7
   points. Reaching p<0.05 by Fisher exact at 6 vs 6 needs roughly 0/6
   vs 5/6. Anything less is a difference, not a result.
2. It is circular. v1's B.5 defines cases 7 to 10 as "the same symptom in
   four registers", which means the labels are identical by construction.
   The team wrote the cases, the labels, and the baseline. The question
   that ends the conversation: "who labeled these, and what happens to the
   chart if I disagree with three of your labels?"
3. The pipeline makes two LLM calls and the baseline makes one, so any gain
   may be inference count rather than normalization.

Reframed below in section 4. The new framing needs no ground truth labels
at all, which deletes the circularity attack entirely.

### 0.4 An unreachable classifier failed toward mild

v1's code held at MILD when Gemini was unavailable, while v1's own Part H
mandated MODERATE. With no API key, every non-emergency returned MILD with
reasoning that said "flagged for human review" while the action said "log
and continue". Nothing was flagged. On congested venue wifi this silently
turns every moderate demo into a mild one and the presenter does not notice.

Now fails toward attention at MODERATE.

---

## 1. Scope decisions

v1 is roughly 45 to 55 person-hours. Decide these now, not at 6am Sunday.

### CUT

**Retry state machine (v1 B.4) and the compression toggle.** No judge will
observe a retry: it only manifests over 15 to 30 real minutes or behind a
toggle nobody presses. Ship it as a README diagram and one trace line.
The design is the value; the implementation is invisible. Saves 4 to 6 hours.

**Twilio and real phone calls.** New accounts face verification that cannot
be reliably cleared in 33 hours, trial accounts play an audible disclaimer
before connecting, and PSTN setup latency eats the 90 second call budget.
At an in-person science fair the judge is standing in front of the laptop
anyway. Use the ElevenLabs browser widget. Saves 2 to 4 hours and removes an
unbounded risk. Consequence: no patient needs a real phone number, which
also removes the privacy problem in section 5.

**Real Backboard, downgraded not cut.** Implement the v1 Part G memory
semantics against a local memory.json behind a two method interface.
Identical demo behavior and identical trace event. Swap in the real API only
if ahead on Saturday evening, purely for the branded prize.

### KEEP, non negotiable

Tier 0 and Tier 1 with the max() safety property. The eval harness. The
trace stream and judge console. The ElevenLabs agent with both tools. Public
repo with in-window commits. A rehearsed two minute pitch.

---

## 2. Build order

The serial chain. Nothing later can be proven until the thing before it is.

    contract freeze
      -> publicly reachable backend URL
      -> agent successfully calls that URL and speaks the result
      -> real triage engine swapped in behind it

Everything else is parallel leaf work and cannot block.

| Gate | What must be true |
|---|---|
| G0 | Repo public, contracts frozen, roles assigned. DONE |
| G1 | /triage returning hardcoded plan-shaped JSON, /health, trivial /trace echo, deployed at a stable https URL |
| G2 | A real voice call fires report_symptom against that URL and the agent speaks the canned response. Brain still a stub. |
| G3 | Real classifier swapped in behind the same contract. Nothing upstream changes. |
| G4 | /trace streams real events and the console renders them |
| G5 | Eval produces real results.json, chart reads it |
| G6 | Three consecutive clean rehearsals, backup video recorded while everything works |

G1 and G2 are the whole ballgame. Deploy at hour two, not hour twenty: the
agent config holds a hardcoded webhook URL, and every URL change means
re-editing the agent and re-testing a voice call. Get one stable URL and
never touch it again.

Verify inside G1, because finding out later is expensive:
- WebSockets survive the host's proxy. Put a two line echo endpoint in the
  first deploy and hit it from a browser console. If it fails, fall back to
  polling /trace/events?since=N. The panel looks identical to a judge. Do
  not spend more than 30 minutes fighting this.
- The Gemini model id resolves. requirements.txt pins the legacy SDK and
  the model name is currently unverified because no key has been present.

---

## 3. Contract reconciliation: adapt, do not rewrite

The rewrite costs 3 to 4 hours and buys nothing. The adapter costs about 50
minutes and keeps all 70 tests green.

Trap to name out loud: **the word "tier" means two different things.** In
v1's API contract, `tier` is the severity label. In the engine, `tier` is
which stage produced the answer. Name these distinctly in code or someone
conflates them at 4am.

| API field | Source |
|---|---|
| `tier` | `result.severity.name.lower()` |
| `source` | `rule` on tier_0; `llm` on a parsed tier_1; `fallback_error` when the classifier failed |
| `normalized_text` | new optional field, default None |
| `confidence` | new optional field, 1.0 on a rule match |
| `reasoning` | LLM reasoning, else `result.reasoning` |
| `suggested_agent_response` | static lookup table keyed by tier. NOT an LLM call. |
| `is_crisis` | already implemented |

Keep `triage_engine.py` free of FastAPI. Adapt at the boundary.

Also reconcile before any frontend is written against it: patient ids
(`p1` vs `pt-1001`), `derived_schedule` vs `schedule`, and `timing` as a
dict vs a comma string. The last one is a 500 on the first click of the demo
if the frontend is built to v1's shape.

---

## 4. The eval, reframed

Build this FIRST, tonight, before any frontend. It is about 60 lines and a
few minutes of API time, and it is the only item in the plan that can
invalidate the pitch. Everything else can be built under pressure. A
measurement cannot, and fabricating one at a medical school is an integrity
failure rather than a scoping failure.

**Framing: paraphrase invariance, not under-triage rate.**

For each symptom scenario, generate several paraphrases across registers and
measure whether the classifier returns the same tier for semantically
equivalent inputs. This needs no ground truth labels, so there is nothing to
accuse of circularity. The claim becomes:

> Whatever the correct answer is, the naive pipeline gives a different one
> depending on how the patient talks. Ours does not.

Three arms, same model, same temperature, same classification prompt. The
only difference is what the classifier sees:
1. naive: raw transcript, single call
2. chain of thought: single call, restate clinically then classify
3. normalize then classify

Arm 3 versus arm 2 is what isolates normalization from inference count.

Five repeats per case. Report mean and spread. Publish both prompts side by
side on the console: preempting the circularity question is worth more than
any animation.

**Pre-commit to the fallbacks now, while calm:**
- Effect present: lead with it, with error bars.
- Effect zero: "we tested for phrasing bias and did not find it at this
  sample size, which is why the safety floor is deterministic rather than
  trusting the model." This is a good demo.
- Effect backwards: report it. "Normalization discarded hedging language and
  over-triaged" is the most memorable result at the fair and nobody else
  will have a negative finding.

Run it once, commit results.json, have the chart read the committed file.
Never call the model live from the chart.

**Chart wording.** Title: "Triage consistency across phrasing styles".
Rename the "Code-switched" category to "Mixed-language". Caption, always
visible:

> Internal evaluation on symptom descriptions written by the project team
> across several phrasing styles. This demonstrates the evaluation method,
> not a measurement of real-world bias. The sample is small, non-clinical,
> not representative of any population or language community, and was
> authored by non-clinicians. No claim is made about how CareLoop would
> perform on real patient speech.

---

## 5. Safety, privacy, and claims

**Latency.** v1's two sequential Gemini calls put 2.7 to 5.0 seconds of dead
air into a live call, up to 9.3 in the bad case. Merge into a single call
whose JSON schema is ordered `normalized_text` first, then `tier`. Because
keys generate in order, the tier is still causally conditioned on the
normalization. Same mechanism, one round trip. Disable thinking tokens, cap
output tokens, hard 2.5s timeout falling back to MODERATE, and have the
agent speak a filler the moment the tool fires.

Keep the two-call version in the eval only, where latency is free.

**Demo asset nobody noticed:** the emergency path makes zero LLM calls, so
it is visibly the fastest response in the demo. Say it out loud: "notice
that came back instantly, because no model was consulted."

**No real phone numbers in tracked files.** Moot now that Twilio is cut.

**Provider slots.** v1 pops slots on booking with no reset. With 4 total
non-emergency slots the demo breaks for good by run 2 or 3, and a science
fair is many repeat runs. Do not pop. Always return the first matching slot.
Nobody is judging double-booking correctness.

**Emergency never books.** prov4 has an empty slot list, so booking on the
emergency path is an unhandled index error on the highest stakes scenario.
Never call /book for EMERGENCY, and add a test asserting it.

**Auth.** The trace stream and the webhook both carry patient-shaped data on
a public URL. A static shared secret on each, checked server side, is about
15 minutes and is not optional before deploying.

**Disclaimers.** README top, dashboard footer, console above the trace, and
spoken by the agent in the greeting: "I'm an automated check-in assistant,
not a medical professional, and this is a demonstration." Twelve words,
three seconds, and it is the single most credible thing you can do in front
of a clinician judge.

Never claim, anywhere public: diagnoses, clinically validated, FDA
compliant, HIPAA compliant, safe, accurate, replaces a nurse line, reduces
ER visits.

**How to answer the regulatory question**, roughly verbatim:

> CareLoop is a research prototype, not a medical device. A patient-facing
> tool that recommends emergency care would very likely be regulated under
> FDA's clinical decision support framework: it is directed at a patient,
> it is time-critical, and the patient cannot independently review the
> basis. We are not claiming the exemption. What we built is the safety
> architecture you would need before you could pursue that pathway.

Add an MIT LICENSE file.

---

## 6. Value per hour

Build top down. Cut bottom up.

| Component | Hrs | Value |
|---|---|---|
| Contract adapter over the existing engine | 0.8 | very high |
| Trace panel and stream | 3.5 | very high, the proof it is not scripted |
| ElevenLabs agent, two tools, one working call | 3.0 | very high, this IS the demo |
| Eval and chart | 3.0 | very high, the differentiator |
| Tier 0 emergency scenario end to end | 1.0 | very high, most memorable 15 seconds |
| Single call normalize plus classify | 1.0 | high, fixes latency and implements the pipeline |
| Deploy early at a stable URL | 1.5 | high, risk reduction |
| Dashboard connect flow and staggered cards | 2.5 | high, polish is 25 percent |
| Free text box on the console | 0.3 | very high, see below |
| Booking and payer matching | 2.0 | medium high |
| Backboard via local json | 1.0 | medium |
| Real Backboard API | 2.5 | low, cut third |
| Twilio | 3.0 | low, cut second |
| Retry state machine | 5.0 | lowest, cut first |

**The free text box is the highest leverage item in the table.** Let a judge
type their own symptom, unscripted, and watch the trace light up. It proves
the trace is real, and it is a story they retell to the other judges. It is
also now safe to offer, because Tier 0 survives smart quotes, negation,
dialect, and Spanish. Before tonight's fixes, offering it would have been
the fastest way to lose.

**Two items not in v1 that outrank half of it:** record a 90 second backup
video Saturday night while everything works, and do three consecutive clean
rehearsals before sleeping. A demo that has only ever run once has not been
tested.

---

## 7. Frontend

Not Next.js. Two client-only screens, one socket, a Python backend: you get
none of the SSR benefits and all of the friction. Use Vite plus React plus
Tailwind. Exception that overrides this: if whoever builds the UI has
shipped Next.js this month and never used Vite, use Next.js. Switching cost
beats the savings.

### Hosting: GitHub Pages and Vercel

Both are static hosts for the frontend. Neither can run the FastAPI backend
as specified, and the reason matters.

**GitHub Pages serves static files only.** No Python, no server process.
It can host the built frontend bundle and nothing else.

**Vercel can run Python, but not a WebSocket server.** Vercel serverless
functions do not support long-lived WebSocket connections. The /trace
stream is the one piece of this build that depends on exactly that.

So the split is forced:

| Piece | Host | Note |
|---|---|---|
| Frontend bundle | Vercel primary, GitHub Pages mirror | both fine, both free |
| REST endpoints | Vercel Python functions, or the backend host | works either way |
| /trace live stream | NOT Vercel, NOT Pages | needs a real server process |

Two viable configurations. Pick one tonight:

**A. Frontend on Vercel plus Pages, backend on DigitalOcean.**
Keeps WebSockets. Keeps the DigitalOcean opt-in prize, which is a listed
MLH prize at this event while Vercel is not. Cost: the frontend and backend
are now separate origins, so CORS must be configured, and there are two
platforms to debug instead of one.

**B. Everything on Vercel.**
Simplest operationally, one platform, one deploy. Cost: /trace must stop
being a WebSocket and become polling of /trace/events?since=N every 500ms.
The trace panel looks identical to a judge. Also forfeits the DigitalOcean
prize opt-in.

Recommendation: **A**, because the DigitalOcean prize is real money on the
board and the WebSocket is the honest implementation. But if the team is
two people, take **B** and poll, because one platform at 4am beats two.

Either way, put the backend base URL behind a single env var so the
frontend can be repointed in one edit if the venue wifi forces a fallback
to localhost.

**GitHub Pages caveat on the deadline.** The rules require no commits after
09:00 Sun. If Pages is deployed by a GitHub Action, the bot writes commits
to a gh-pages branch, and a post-deadline bot commit is an argument you do
not want to have with a judge. Either deploy Pages from the /docs folder on
main, or run the final Pages deploy well before 08:30 and disable the
workflow afterward.

Skip the charting library. The fairness chart is a horizontal grouped bar
with fixed heights: eight divs with width transitions. A chart library takes
longer to configure to the spec than writing the divs.

---

## 8. Open decisions, needed from the team

1. **Team size.** v1 is a 3 to 4 person plan. At 2 people, apply all three
   cuts tonight rather than when behind.
2. **Track.** One only. Forge Healthcare is $2,000 but contingent on joining
   the cohort, and it is the most crowded track at a JHU hackathon. Bloomberg
   Most Philanthropic fits the equity angle and the field is thinner. Take
   Forge only if every teammate will genuinely join the cohort. Either way
   the track does not touch the opt-in prizes, which is where the expected
   value is: ElevenLabs twice, Gemini, Backboard, Auctor, DigitalOcean,
   SpaceXAI, GoDaddy.
3. **The Gemini API key.** Still not present. Tier 0 is unaffected, but
   nothing in Tier 1 can be verified until it exists, including whether the
   pinned model id resolves.
