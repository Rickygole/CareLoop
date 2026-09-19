# Tier rubric

The operational definition of each tier. The classifier prompt uses this same
text. Gold labels are assigned against it. If the two ever drift apart the
evaluation stops describing the product.

**EMERGENCY scores as `severe` for all evaluation purposes.** Under-triage
rate is undefined until that mapping is fixed, so it is fixed here and
nowhere else.

## mild

Expected, minor, or self-limiting. No action beyond logging.

- No symptoms, or a routine confirmation that the dose was taken
- A known and tolerable side effect that is not worsening and does not
  interfere with daily activity
- Examples: slight tiredness, a mild headache, transient nausea that passed

## moderate

Interfering, persistent, or worsening. Warrants a clinician callback within
24 hours but is not same-day.

- A symptom that interferes with normal daily activity
- A symptom that is persistent (more than roughly two days) or worsening
- A new symptom that plausibly relates to the medication and has not been
  evaluated
- Examples: vomiting after every dose for three days, dizziness on standing,
  a new rash without breathing involvement, swelling in the legs

## severe

Needs same-day clinical attention, or is immediately life threatening.

- Any red flag caught by the deterministic rule layer
- A symptom a reasonable clinician would want evaluated the same day
- Rapid worsening, or a symptom limiting the ability to function
- Examples: chest pain, breathing difficulty, airway swelling, loss of
  consciousness, severe bleeding, stroke indicators, suspected overdose

## Boundary rules

When an utterance sits between two tiers, assign the **higher** tier. This is
asymmetric on purpose: the cost of under-triage is clinical, the cost of
over-triage is a callback.

Hedging is not evidence of mildness. "It's probably nothing, but" followed by
a moderate symptom is moderate. The tier describes the symptom, not the
patient's confidence about it.

A third party reporting on a patient ("my husband is unresponsive") is scored
the same as first person.

## Protocol basis

Each vignette records the specific rule that decides its gold label in a
`protocol_rule` field. Labels are derived from a published criterion, not
voted on. Labelers are project teammates, not clinicians, and are not
independent of the authors. This is stated wherever the labels are reported.
