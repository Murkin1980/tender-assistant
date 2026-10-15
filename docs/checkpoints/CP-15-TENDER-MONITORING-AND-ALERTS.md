# CP-15 — Tender monitoring and alerts

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Stop requiring manual repeated checking of saved tenders.

## Required outcome
- bounded scheduled refresh only for saved/active tenders;
- detect meaningful deadline/status/document changes;
- compact change history;
- idempotent checks;
- actionable alerts with deduplication;
- failure/retry rules;
- operator can see last successful check.

## Constraints
No unbounded market crawler. Do not alert on noisy/non-actionable changes.

Notification channel must be selected from an existing approved channel/integration; adding new recurring cost requires approval.

## Acceptance
A deterministic changed-source fixture produces one alert, an unchanged refresh produces none, repeated checks are idempotent, and failures do not create false changes.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
