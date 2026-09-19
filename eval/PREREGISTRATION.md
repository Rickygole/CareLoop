# Preregistration

Written and committed before any vignette text, any model call, or any result
exists for the v2 eval. If a later commit touches this file's confirmatory
section, that is a deviation and must be called out as one, not folded in
quietly.

## Corpus

8 scenarios times 3 gold tiers (mild, moderate, severe) equals 24 vignettes.
Each vignette carries 5 condition texts: A (clinical register, Standard
American English, the control), A_prime (a paraphrase of A, same register and
variety, reworded, the noise floor), B (casual register, SAE), C (dialect
morphosyntax and lexicon in clinical register), D (casual register plus
dialect features).

8 vignettes are dev. 16 are test. The split is fixed at scaffold time, before
any text is written, and is recorded per vignette in the cases file. Test is
frozen once text is filled in: no prompt, rubric wording, or scoring logic
change after that point may be tuned against test-set outcomes. Every prompt
version that is ever scored against the frozen test set gets logged, with a
running count, in the results file this harness produces.

## Confirmatory contrast (the only one)

Metric: under-triage rate, conditioned on gold tier, computed only on the 16
test vignettes.

Contrast: naive arm, condition D versus condition A, paired by vignette.

Test: McNemar's test on the paired binary under-triage indicator (did this
vignette get under-triaged in D, did the same vignette get under-triaged in
A). Cluster bootstrap 95 percent CI, 10000 resamples, resampling vignettes
with replacement.

This is the one number this project is allowed to call confirmatory. Every
other number in the harness, including the rules_only and full arms, the
gold=moderate slice, over-triage, ordinal error, action-router accuracy, and
any A versus B or A versus C contrast, is exploratory. Exploratory results
can motivate the next preregistration. They cannot be reported as if they
were tested in advance, because they were not.

## Stopping rule

Decided now, before the number exists, precisely so it cannot be decided
after looking at the number.

If the 95 percent CI on the naive-arm, D-versus-A, under-triage-rate gap
crosses zero, the headline of this eval is not "dialect closes/does not
close a gap." The headline becomes the rules_only arm's catch rate: how much
of whatever gap exists is caught by the deterministic rule layer alone,
independent of the LLM normalizer. That number is reported instead, labeled
as what it is, and the D-versus-A contrast is reported underneath it as a
null result, not omitted.

## Underpowering, said out loud before it is measured

At n=24 vignettes, a two-by-two interaction estimate (condition effect times
arm effect) is built out of four separate proportions, each estimated from a
subset of 24 items. Using the conservative closed-form bound for a
difference-of-differences of paired proportions (worst-case variance at
p=0.5 in every cell, normal approximation, 95 percent confidence):

    SE = sqrt(4 * 0.5 * 0.5 / n),  half-width = 1.96 * SE

At n=24 this gives a half-width of about 0.40, i.e. 40 percentage points.
score_v2.py computes this number from n at run time rather than hardcoding
it, so if the corpus size ever changes this document and the code cannot
silently disagree. Any interaction reported by this harness must carry the
sentence:

"At n=24 this design cannot detect interaction effects below roughly 40
points; we report the estimate as exploratory and do not claim
superadditivity."

No superadditivity claim is permitted regardless of what a point estimate
looks like, because this design cannot distinguish a real interaction from
noise at any effect size a real product would care about.

## Fixed constants, decided here so they are not re-decided per script

EMERGENCY (the deterministic Tier 0 rule layer's top severity in
triage_engine.py) scores as `severe` for every metric in this eval. There is
no fourth class in this eval's gold or predicted label space. This constant
is defined in exactly one place, `eval/rubric.md`, and imported everywhere
else it is needed.

Model snapshot id(s) actually used for a real (non-dry-run) scoring pass must
be pinned and printed into the results file verbatim, including whether the
id is a floating alias (e.g. an untagged "-latest" name) or a dated snapshot.
A floating alias is not a pin; if only a floating alias is available, the
results file must say so rather than imply reproducibility it does not have.

k=3 full repeats of the real scoring pass are required, at temperature 0.
Temperature 0 is not determinism: run-to-run disagreement across the 3 runs
is measured and reported per arm and condition, not assumed to be zero.

## Leakage bookkeeping

Every time the frozen test set is scored with a prompt or scoring-logic
version that was not the version used the previous time, that is logged as a
new "prompt version scored against final test set" entry in the results
file, with a counter. A high count on that counter by itself is a finding:
it means the test set stopped being held out in spirit even if it was never
edited.
