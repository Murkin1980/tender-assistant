# CP-04 — Goszakup live-source adapter

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the CP-03 lot domain/API contracts and existing NestJS structure. Do not create a parallel ingestion service or repository.

## Objective

Add the first real procurement-source integration boundary for Tender Assistant:

**official Goszakup OWS v3 → normalized existing lot model → deterministic tests → optional live read-only probe.**

This checkpoint proves that real Goszakup data can be translated into the CP-03 domain without yet adding persistence, queues, scraping, document parsing, RAG, or LLMs.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-03-LOTS-VERTICAL-SLICE.md`
6. this checkpoint

Use the smallest sufficient change and preserve all CP-03 behavior.

## Authoritative upstream contract

Use only the official Kazakhstan public-procurement OWS documentation as the source contract.

Current documented v3 GraphQL endpoint:

`POST https://ows.goszakup.gov.kz/v3/graphql`

Authentication is via:

`Authorization: Bearer <token>`

The token must come from environment/config only. Never hard-code, print, commit, snapshot, or expose it to frontend/browser code.

The official portal documents GraphQL schema/help under:

`https://ows.goszakup.gov.kz/help/v3/schema/`

If the live upstream behavior differs materially from the documented contract, do not invent compatibility layers. Record the exact mismatch and return BLOCKED/PARTIAL as appropriate.

## Scope

### 1. Source boundary

Introduce the smallest source abstraction needed so the existing CP-03 fixture-backed implementation remains valid while a Goszakup implementation can provide normalized lots.

Prefer extending the current service structure rather than creating a generic framework.

There must be one normalized lot contract used downstream. Do not create a second parallel `GoszakupLot` domain that leaks into frontend/API.

Raw upstream DTOs may exist only at the integration boundary.

### 2. Goszakup client

Implement a small read-only client for OWS v3 GraphQL.

Requirements:

- base URL configurable, with the official v3 endpoint as the safe default;
- bearer token from backend environment only;
- bounded request timeout;
- explicit upstream HTTP/error handling;
- GraphQL `errors` handled as failure even when HTTP status is 200;
- no retries unless an existing project mechanism already provides them;
- no secrets in logs/errors;
- no browser-side call to Goszakup;
- no mutation/write operation against Goszakup.

Do not add a dependency if Node's existing HTTP/fetch capability is sufficient.

### 3. Normalization

Map the minimum upstream fields needed into the existing CP-03 lot model.

At minimum preserve/derive when available:

- stable external id;
- source = `goszakup`;
- source/public URL or a deterministic registry URL;
- title/name;
- amount;
- customer name/BIN when available from the chosen query;
- published/deadline timestamps when available;
- region/district or location text when actually provided by upstream data;
- description/search text when available.

Do not fabricate missing fields.

If CP-03 currently marks some fields required but Goszakup cannot supply them in the selected query, make the smallest domain adjustment necessary and cover it with tests. Do not broaden the whole model speculatively.

### 4. Query boundary

Implement one bounded query path intended only to prove source integration.

Prefer a small page/limit such as 5–20 records.

Do not implement full historical import, pagination crawling, backfill, or scheduling.

Do not attempt to solve all furniture classification at the upstream query layer. Fetch a small bounded sample and normalize it.

### 5. Deterministic testing

All automated tests must run without a real Goszakup token or network access.

Add fixtures representing upstream GraphQL responses and tests for:

- successful mapping;
- missing optional fields;
- GraphQL error response;
- HTTP/non-2xx error;
- timeout/aborted request if practical with the current test setup;
- token not exposed in returned/public error text.

Reuse existing test tooling.

### 6. Optional live probe

Add a minimal developer-only/read-only probe command or equivalent backend-internal path that runs only when `GOSZAKUP_TOKEN` is present.

The probe must:

- request a bounded number of records;
- print only non-secret summary evidence;
- prove that at least one upstream object can be normalized;
- never persist data;
- never expose the token.

If Arena has no token, this is **not** a checkpoint failure. The implementation may still PASS when deterministic contract tests and all project checks pass. Report live verification as `NOT RUN — GOSZAKUP_TOKEN unavailable`.

Do not request the owner to paste a secret into chat, PR, issue, fixture, or repository.

## Default product behavior

CP-03 fixture-backed `/lots` and `/lots/[id]` must continue working unchanged by default.

Do not switch the production/default UI to live Goszakup data in this checkpoint.

Do not add a public `source=goszakup` mode merely for demonstration unless the existing API already has a clean source-selection contract. The purpose here is the source adapter boundary, not a second user-facing mode.

## Environment/config

If needed, document only:

- `GOSZAKUP_TOKEN`
- optionally `GOSZAKUP_GRAPHQL_URL` if the project configuration pattern justifies it.

Update `.env.example` with empty/example-safe values only.

Never commit a real token.

## Out of scope

Do **not** add:

- PostgreSQL / ORM / migrations;
- persistence of fetched lots;
- Cloud SQL;
- object storage;
- full import/backfill;
- scheduled ingestion;
- background jobs/queues;
- Samruk-Kazyna integration;
- HTML scraping/browser automation;
- tender-document downloads;
- OCR/document parsing;
- embeddings/RAG/LLM;
- authentication/users;
- new cloud infrastructure;
- deployment changes;
- a second frontend data model;
- a generic multi-source framework beyond what one real Goszakup adapter actually needs.

## Acceptance criteria

1. Existing CP-03 lot API/UI behavior remains green and fixture-backed by default.
2. A backend-only Goszakup v3 client exists and uses `GOSZAKUP_TOKEN` from environment.
3. The token cannot reach frontend code or normal API responses.
4. A bounded GraphQL request can be represented using the official v3 contract.
5. Upstream response data is normalized into the existing lot domain.
6. Mapping is deterministic and covered by tests.
7. HTTP and GraphQL failures are covered by tests.
8. Missing optional upstream fields do not cause fabricated data.
9. No new persistence or infrastructure is introduced.
10. `pnpm format:check` passes.
11. `pnpm lint` passes.
12. `pnpm typecheck` passes.
13. `pnpm test` passes.
14. `pnpm test:e2e` passes.
15. `pnpm build` passes.
16. GitHub CI is green.
17. If a valid token is available in the execution environment, the bounded live probe succeeds; otherwise explicitly report it as not run.

## Branch / PR

- Start from current `main`.
- Use the Arena session's dedicated branch.
- Keep changes limited to this checkpoint.
- Commit and push the exact tested state.
- Open a PR into `main`.
- **Do not merge the PR.**
- Stop after the PR is open and CI is green.

## Deep-change / stop conditions

Stop only the affected portion and report the issue if completing it would require:

- a new repository/service;
- a new infrastructure platform;
- persistence/schema migration;
- a public API redesign;
- browser automation/scraping because the official OWS contract is unavailable;
- a secret being committed or passed through public/client code;
- paid or irreversible infrastructure.

Do not expand the checkpoint to solve those issues.

## Evidence / final report

Return only:

```text
RESULT: PASS | BLOCKED | PARTIAL
Branch: ...
Commit: ...
PR: ...
Tests: ...
Build: ...
CI: ...
Goszakup live probe: PASS | NOT RUN | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or start the next checkpoint.
