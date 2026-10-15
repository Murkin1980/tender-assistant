# CP-13 — Production runtime and live release path

Status: PARTIAL — runtime/release path implemented; production rollout blocked pending owner-provisioned GCP VM/domain and Goszakup token

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Make the already-working CP-12 system safely usable in a real private production environment with live Goszakup.

## Required outcome
- explicit production hosting target and architecture decision;
- live `TENDER_LOT_SOURCE=goszakup`;
- secrets stored outside the repository;
- private/operator access boundary;
- frontend/backend production URLs and TLS;
- health/readiness checks;
- deployment and rollback procedure;
- production smoke test using a real bounded Goszakup path;
- no token exposure.

## Constraints
Prefer the existing Docker/Node/Next/Nest architecture. Any platform migration or major architecture change triggers the deep-change gate.

No database, scheduler, OCR, AI, or feature expansion in CP-13.

## Acceptance
A fresh production deployment can be reproduced, a private operator can open the app and complete list -> detail -> documents -> requirements on live data, health checks pass, secrets stay server-side, and rollback is documented and tested.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
