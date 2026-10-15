# CP-17 — Participation readiness checklist

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Turn extracted requirements into a practical participation checklist.

## Required outcome
Classify source-linked obligations into at least:
- qualification;
- required certificates/evidence;
- bid/security guarantees;
- required attachments/forms;
- technical requirements;
- delivery/location/timing;
- commercial/payment obligations;
- manual-review gaps.

Each checklist item must have source evidence and state: READY / MISSING / REVIEW / NOT_APPLICABLE where deterministically known.

## Constraints
No legal conclusion and no invented requirement. Unknowns remain REVIEW.

## Acceptance
For supported tender fixtures/documents, the operator can see exactly what participation evidence is required and which items still need manual verification.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
