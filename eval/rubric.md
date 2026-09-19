# Tier rubric (pointer, not a copy)

This eval's original build plan called for the operational tier rubric to
live at `eval/rubric.md`. Partway through this build, the canonical rubric
was written and committed at `docs/TIER_RUBRIC.md` by the project owner's
own process, already scoped to do exactly what this file was meant to do:
pin `mild` / `moderate` / `severe`, pin `EMERGENCY` as `severe` for every
evaluation purpose, and state the boundary rules (ties go to the higher
tier, hedging is not evidence of mildness, third-party reports score the
same as first person).

Copying that text into a second file here would recreate the exact failure
mode the rubric itself warns about: "if the two ever drift apart the
evaluation stops describing the product." So this file stays a pointer
instead of a duplicate.

`eval/score_v2.py` reads `docs/TIER_RUBRIC.md` at run time and puts its
literal text into the classifier prompt, and the same file is what
`eval/vignettes.v2.json` cites in its own `tier_rubric` field for gold
labeling. One file, three consumers (prompt, gold labels, this note),
checked at load time: if `docs/TIER_RUBRIC.md` is missing, a real
(non-dry-run) `score_v2.py` run refuses to start rather than falling back to
a guess at what the rubric says.

`--dry-run` does not require `docs/TIER_RUBRIC.md` to exist. It uses a
small built-in fallback rubric string so the pipeline is exercisable with
nothing on disk beyond `eval/vignettes.v2.json`, per the original build
requirement that the dry run have zero external dependencies. That fallback
text is intentionally shorter than the real rubric and must never be used
for a real run; `score_v2.py` checks for and refuses that combination.
