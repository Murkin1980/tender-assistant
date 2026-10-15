# CP-13 — Production runtime and live release path

Status: PARTIAL — Cloudflare runtime path implemented; production rollout blocked by missing Goszakup token and live acceptance evidence

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

- **Automated checks: PASS.** [GitHub Actions CI run #68](https://github.com/Murkin1980/tender-assistant/actions/runs/38792790211) passed on commit `6ec089f41c920cdd657b7227f45643fbc46610bc`: quality gates and Docker smoke, including production Compose/Caddy validation with synthetic values.
- **Local checks: PASS.** `format:check`, `lint`, `typecheck`, `test` (172 backend + 43 frontend), `test:e2e` (107), `build`, shell syntax, and `git diff --check` passed.
- **Production URL/status: BLOCKED.** No VM, GCP project/credentials, DNS domain, or live Goszakup token was available. Frontend production URL is absent/not provisioned; no public backend URL is designed. Internal backend target is `http://backend:3000`.
- **Live flow and rollback execution: NOT RUN.** Deployment/smoke/rollback scripts and evidence fields are documented, but no live Goszakup lot/documents/requirements flow or production rollback is claimed.

## Cloudflare feasibility and implementation evidence (2026-10-16)

- **Disposition: Workers.** Next.js 16 uses OpenNext/Static Assets; NestJS uses the supported
  `cloudflare:node` HTTP bridge. The backend remains private behind a Workers service binding.
  Pages is not the current full-stack Next.js path; an external backend is unnecessary.
- **Compatibility: PASS locally.** A bundled NestJS Worker (about 3.0 MiB uncompressed) booted in
  workerd and returned HTTP 200 for health, readiness and `source=goszakup` with a sentinel secret.
  `node:zlib`, Buffer/streams and the unchanged CP-12 parser remain under the existing 5 MiB
  download / 10 MiB inflate bounds and Workers' 128 MiB isolate limit. Paid Workers is required
  because Free's 10 ms CPU limit is unsuitable for SSR and synchronous document parsing.
- **Small diff.** Added Worker entry/config files, OpenNext adapter/config, one private service
  binding and SHA-tagged deploy/rollback scripts. Docker/GCE/Caddy remains intact as fallback.
- **Production: BLOCKED.** Wrangler authentication and the Cloudflare account are available, but
  no `GOSZAKUP_TOKEN` exists in the environment or account secret store. The token must not be
  invented, extracted or committed. Consequently custom-domain production deployment, Access,
  real live documents/requirements smoke, log leak audit and rollback/redeploy are not claimed.
