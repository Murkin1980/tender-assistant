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

## Implementation evidence (2026-10-15)

- **Automated checks: PASS.** [GitHub Actions run #13](https://github.com/Murkin1980/tender-assistant/actions/runs/38792352283) passed on commit `74a14c26bfff0edb418ddc04e919ceb12477fc5d`: quality gates and Docker smoke, including production Compose/Caddy validation with synthetic values.
- **Local checks: PASS.** `format:check`, `lint`, `typecheck`, `test` (172 backend + 43 frontend), `test:e2e` (107), `build`, shell syntax, and `git diff --check` passed.
- **Production URL/status: BLOCKED.** No VM, GCP project/credentials, DNS domain, or live Goszakup token was available. Frontend production URL is absent/not provisioned; no public backend URL is designed. Internal backend target is `http://backend:3000`.
- **Live flow and rollback execution: NOT RUN.** Deployment/smoke/rollback scripts and evidence fields are documented, but no live Goszakup lot/documents/requirements flow or production rollback is claimed.
