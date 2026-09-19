# CareLoop Demo Script

A rehearsable two minute walkthrough for the table. Time it against a clock
at least three times before judging. If something breaks live, fall back to
the backup video rather than debugging in front of a judge.

Keep `docs/PLAN.md` section 5 open on a second screen. The regulatory answer
below is taken from it and you should not paraphrase it from memory under
pressure.

Demo patient is **p1, Maria Santos**. She is the only patient with two daily
doses, so the reminder step always has something to show. Do not demo p2 or
p3 late in the day; their single dose can fall outside the window and the
first step of the loop will have nothing to say.

---

## 0:00 to 0:15  Open with the disclaimer, unprompted

> "Quick disclaimer before I show you anything: this is a hackathon
> prototype, not a medical device, not medical advice, and everything you
> see uses synthetic patient data. If you're experiencing a real emergency,
> call 911, and if you're in crisis, call or text 988. Okay, here's what
> we built."

Volunteering this before a judge asks is the single most credible thing you
can do at this table. Do not wait to be asked.

---

## 0:15 to 0:35  The one sentence version

> "CareLoop calls patients to check they took their medication. If they
> report something concerning, it triages what they said, and then it calls
> the clinic and books the follow-up itself. The patient never types
> anything and never logs in. They connect their portal once and answer
> the phone."

---

## 0:35 to 1:00  Run the loop. One button.

Press **Run the check-in call** on the console. Let it play. Narrate over it:

> "That is one press. It reminded her about her eight AM metformin, asked
> how she's feeling, triaged what she said, then called the office, gave
> the reason for the visit, gave her insurance, took the slot, and told
> her it was booked."

Point at the clinic transcript.

> "That conversation is our agent talking to a front desk. The front desk
> is simulated and we label it as simulated, because a booking demo that
> implies we called a real medical office is not a demo anyone should give."

---

## 1:00 to 1:20  The strongest ten seconds. Hand them the keyboard.

Ask the judge to type an emergency in their own words into the free text
box. Anything. Let them invent it.

When it comes back, point at the latency and the source field.

> "That came back in about two milliseconds and the source says rule.
> No model was consulted. Emergency detection is deterministic regex, and
> the model is never given the opportunity to talk us down from an
> emergency. It can raise severity. It cannot lower it."

Then ask them to type a negation. Suggest: **"no chest pain today, I feel fine"**

> "And it does not fire on that. Negation, past tense, hypotheticals.
> Thirteen out of thirteen in our test set. Every team here can make
> something fire on the words chest pain. Almost none can make it not fire."

If they speak Spanish, invite them to try it. `tengo dolor en el pecho`
reaches the emergency path.

---

## 1:20 to 1:40  The measurement

> "We preregistered one test with a stopping rule before we ran it. 1,260
> model calls, 24 vignettes across five phrasings and three arms. It came
> back null. We did not find the gap we went looking for."

> "And our own pipeline lost to the naive baseline on casual and dialect
> phrasing, 75 percent over escalation against 25. We are telling you that
> because we wrote down what would count as failure before we looked."

> "It is also why our emergency floor is a regex and not a model. We
> already did not trust the model layer. Now we have a number for why."

Do not oversell this. If a judge pushes on sample size, agree with them
immediately, see the prepared answer below.

---

## 1:40 to 2:00  Close

> "So the loop is: we remind, we listen, we triage deterministically first
> and with a model second, we act on it by booking the visit, and the next
> call remembers what happened on this one."

---

## Prepared answers

### "Is this a medical device?"

> "No, and I want to be precise about that. A patient facing tool that
> recommends emergency care would very likely be regulated under the FDA's
> clinical decision support framework: it is directed at a patient, it is
> time critical, and the patient cannot independently review the basis. We
> are not claiming the exemption. What we built is the safety architecture
> you would need before you could pursue that pathway."

### "Who labelled your eval data?"

> "We did, and that is a real limitation. We wrote the sentences and we are
> not clinicians. That is why we did not frame it as a bias measurement.
> We measured whether the classifier gives the same answer for the same
> symptom phrased differently, which needs no ground truth labels at all.
> The next step would be clinician labelled transcripts from real speakers,
> and that needs IRB."

### "What about false negatives in your regex?"

> "That is the right question and it is the honest limit of the approach.
> A rule layer only catches what we wrote down. What we can show is that it
> holds across informal, dialectal and Spanish phrasing, and that when it
> does not match, the model still runs and can escalate. The rule layer is
> a floor, not a ceiling."

### "What would you need before this touches a real patient?"

> "A business associate agreement with every vendor in the stack, clinician
> labelled validation data, and prospective testing. Gemini's own terms
> would probably push us to self host the classifier for anything clinical."

---

## If something breaks

- **Tier 1 returns `fallback_error`.** Say it out loud: "the model is
  unreachable right now, and notice it failed toward more attention rather
  than less, it returned moderate rather than mild. That is deliberate."
  This is a better answer than an excuse.
- **Network is gone.** Switch to the backup video. Do not debug live.
- **The trace looks stale.** Press reset on the console between judges.

## Before you present

- Run it three times end to end without stopping.
- Record the backup video while everything works.
- Confirm the deployed site loads on a phone, not just the laptop.
