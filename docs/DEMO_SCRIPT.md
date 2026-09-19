# CareLoop Demo Script

A rehearsable two minute walkthrough for the table. Time it against a clock
at least three times before judging. If something breaks live, fall back to
the backup video rather than debugging in front of a judge.

Keep `docs/PLAN.md` section 5 open on a second screen; the regulatory answer
below is taken from it and you should not paraphrase it from memory under
pressure.

---

## 0:00 to 0:15 -- Open with the disclaimer, unprompted

Say this before anything else, in your own words but keeping the content:

> "Quick disclaimer before I show you anything: this is a hackathon
> prototype, not a medical device, not medical advice, and everything you
> see uses synthetic patient data. If you're experiencing a real emergency,
> call 911, and if you're in crisis, call or text 988. Okay -- here's what
> we built."

Volunteering this before a judge asks for it is the single most credible
thing you can do at this table. Do not wait to be asked.

## 0:15 to 0:35 -- What it is, in one breath

> "CareLoop is a medication check-in voice agent. It calls a patient, asks
> how they're doing, and a triage engine behind it decides how urgent
> whatever they say is. The interesting part isn't the phone call, it's
> the safety floor underneath it."

## 0:35 to 0:55 -- The emergency beat (the strongest ten seconds)

Type or say a clear emergency phrase into the console, live, for example
"I can't breathe." Let the response come back, then say:

> "Notice that came back instantly. That's not the language model being
> fast, that's no model being consulted at all. Tier 0 is a table of
> regular expressions checking for unambiguous emergencies. It's
> sub-millisecond, it runs with zero network calls, and because it fires
> before the language model ever sees the transcript, there is no code
> path where a model can talk an emergency back down. The model can only
> raise severity above this floor. It can never lower it."

This is the moment to let the response sit on screen for a second before
moving on. Do not rush past it.

## 0:55 to 1:10 -- The crisis beat

> "One more thing on purpose: a mental health crisis and a heart attack are
> both flagged at the same urgency, but we route them differently. Watch."

Type a crisis phrase, for example "I want to die." Point out that the
response offers 988 and does not tell the caller to hang up and call 911.

> "Telling someone who just told you they want to die to call the police
> and then hanging up is the most criticized failure mode in AI mental
> health right now. We deliberately do not treat a crisis like a cardiac
> event."

## 1:10 to 1:40 -- Hand the keyboard to the judge

> "Type your own symptom, however you'd actually say it. Don't write it
> like a doctor would."

Let the judge type freely. Whatever tier comes back, narrate what happened:
did Tier 0 fire, or did it pass to the model. This is the proof that
nothing on screen is scripted.

## 1:40 to 2:00 -- Close

> "Everything you just watched is backed by a test suite: ninety tests, all
> offline, no API key required to prove the safety property holds. And to
> be clear again: this is a prototype for a judged event. It doesn't
> diagnose anything and it hasn't touched a real patient."

---

## Prepared answers

Use these close to verbatim. They are pre-committed so you do not improvise
a regulatory claim under pressure.

### "Is this a medical device?"

> "CareLoop is a research prototype, not a medical device. A patient-facing
> tool that recommends emergency care would very likely be regulated under
> FDA's clinical decision support framework: it is directed at a patient,
> it is time-critical, and the patient cannot independently review the
> basis. We are not claiming the exemption. What we built is the safety
> architecture you would need before you could pursue that pathway."

### "Who labeled your eval data?"

> "We did, and we say so. The evaluation is about paraphrase consistency,
> not accuracy against a ground truth label, specifically because we wrote
> the test cases ourselves and grading our own labels would be circular.
> The question we're answering is: does the same underlying symptom get
> the same tier no matter how the patient phrases it. That needs no
> external ground truth at all. The sample is small, non-clinical, and
> authored by non-clinicians, and we say that on the results themselves,
> not just here."

### "What would you need before this touches a real patient?"

> "Clinical validation against real patient transcripts with real labels
> from clinicians, not us. A regulatory pathway determination, since this
> likely falls under FDA clinical decision support guidance and probably
> EU MDR if deployed there. HIPAA-compliant infrastructure, which this
> demo explicitly does not have. And a much larger, adversarially reviewed
> Tier 0 rule set audited by people who are not the ones who wrote it,
> because a rule table we wrote and graded ourselves is not evidence it
> is safe, it's evidence it is safe against the cases we thought of."

---

## If something breaks

Have the backup video ready and say so plainly: "the venue wifi is fighting
me, let me show you the recording from last night while I get this back up."
A demo that has only ever run once has not been tested; a backup that you
are unafraid to reach for reads as competence, not failure.
