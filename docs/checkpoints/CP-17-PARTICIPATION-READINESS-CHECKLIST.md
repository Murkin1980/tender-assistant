# CP-17 — Participation readiness checklist

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Consume the CP-16 requirements report; do not re-parse documents in a second pipeline.

## Objective

Turn the source-linked CP-16 report into the practical question:

**“Что именно нам нужно подготовить и подтвердить, чтобы участвовать?”**

## Required outcome

Classify obligations into at least:

- technical compliance confirmations;
- qualification;
- required certificates/declarations/evidence;
- bid/security guarantees;
- mandatory attachments/forms;
- delivery/installation/service;
- warranty/acceptance;
- commercial/payment obligations;
- manual-review gaps.

Each checklist item must reference the CP-16 source evidence and have an operator state such as:

- READY;
- MISSING;
- REVIEW;
- NOT_APPLICABLE.

Where the system cannot determine readiness from known company/operator data, use REVIEW rather than guessing.

## Report behavior

The tender detail must provide an operator-friendly participation report:

- what the requirement is;
- why it matters;
- what evidence/document is expected;
- current readiness state;
- source citation/locator;
- unresolved question if manual review is needed.

## Constraints

No legal guarantee of eligibility.
No invented requirement.
No duplicate parser.
Unknowns remain REVIEW.

## Acceptance

For the evaluation tenders, the operator can see a complete source-linked participation checklist and identify missing evidence without rereading all supported documents.

## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, CP-16, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
