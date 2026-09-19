# Archived: v1 eval (paraphrase invariance)

The three files in this directory, `score.v1.py`, `cases.v1.json`, and
`results.v1.json`, are the eval harness that ran before this rebuild. They
are kept, not deleted, because the numbers they produced were reported
somewhere and should stay traceable to the code that produced them.

## Why this was superseded

The v1 design measured paraphrase invariance across four registers
(clinical, casual, understated, mixed_language) using only three arms that
were all compared against each other in text form. A methodology review
found the comparison confounded: every condition needs to pass through the
same modality and the same pre-classification path so that a gap between
conditions can be attributed to the condition, not to some conditions
getting a processing step (a rule layer, a normalization pass) that others
did not get. v1 had no rules-only arm, so it could not distinguish "the
normalizer closed the gap" from "the deterministic regex layer closed the
gap." It also had no paraphrase-of-the-control condition, so a gap between
registers had no noise floor to be judged against: a ten point difference
is meaningless without knowing how much two identically-registered
rewordings of the same vignette differ from each other by chance.

v1 also used ground-truth-free consistency as its primary metric specifically
to avoid the circularity of a small team hand-labeling severity and then
grading its own labels. The v2 corpus does use gold labels, assigned against
a published protocol rule per vignette and pinned rubric text; see
`eval/PREREGISTRATION.md` and `docs/TIER_RUBRIC.md` for how that circularity
risk is handled instead, and `eval/README.md` for the limitations that
follow from it.

## Why `eval/results.json` (not archived) still exists

`eval/results.json`, at the top level of `eval/`, was left in place rather
than moved here. `tests/test_eval_integrity.py` asserts that if
`frontend/src/data/eval_results.json` claims `placeholder: false`, then
`eval/results.json` must exist on disk, and that chart currently does claim
`placeholder: false`. Moving the file would fail that test and leave the
committed chart pointing at a real-looking result with no backing file. This
eval rebuild does not have permission to edit `tests/` or `frontend/`, so the
live file stays where the test expects it. `eval/archive/results.v1.json` in
this directory is a byte-identical copy, kept alongside `score.v1.py` and
`cases.v1.json` so the whole v1 bundle can be read together in one place.

Treat every number in `eval/results.json`, `eval/archive/results.v1.json`,
and `frontend/src/data/eval_results.json` as v1: a paraphrase-invariance
percentage, not an under-triage rate, and not comparable to anything the v2
harness in `eval/score_v2.py` produces.
