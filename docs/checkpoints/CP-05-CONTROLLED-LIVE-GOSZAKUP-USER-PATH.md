# CP-05 — Controlled live Goszakup user path

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the CP-03 lot UI/API and the CP-04 Goszakup adapter. Do not create a new service, repository, ingestion pipeline, or persistence layer.

## Objective

Turn the already-built Goszakup adapter into an **optional real user data path** without removing the deterministic fixture mode.

Target flow:

**server configuration selects source → /lots shows normalized live Goszakup lots → user can open a matching /lots/[id] detail → UI clearly states whether data is LIVE or FIXTURE.**

This checkpoint is about wiring and product trust, not historical ingestion or storage.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-03-LOTS-VERTICAL-SLICE.md`
6. `docs/checkpoints/CP-04-GOSZAKUP-LIVE-SOURCE-ADAPTER.md`
7. this checkpoint

Preserve the smallest sufficient change and all existing green behavior.

## Source-of-truth rules

Use the official Goszakup OWS documentation/schema only.

The current CP-04 integration uses:

`POST https://ows.goszakup.gov.kz/v3/graphql`

with backend-only bearer auth.

Before implementing the live detail lookup, inspect the official v3 schema for the narrowest supported way to fetch the selected lot by stable Goszakup id. Do **not** guess a filter field or fabricate an undocumented GraphQL operation.

If v3 has no suitable single-lot lookup, an official documented Goszakup OWS read-only detail endpoint may be used as the smallest fallback **only if it is currently documented by Goszakup and uses the same backend-only authorization boundary**. Do not scrape HTML.

If no documented bounded detail path can be established, stop only that part and report BLOCKED/PARTIAL rather than implementing an unreliable scan.

## Scope

### 1. Runtime source selection

Add one explicit backend configuration value:

`TENDER_LOT_SOURCE=fixture|goszakup`

Rules:

- default when unset: `fixture`;
- unknown values: fail configuration validation clearly;
- `fixture`: current CP-03 behavior remains unchanged;
- `goszakup`: bind the existing `GoszakupLotSource` to the existing `LOT_SOURCE` contract;
- do not expose the Goszakup token;
- do not make source selection controllable by arbitrary browser query parameters.

If `TENDER_LOT_SOURCE=goszakup` is explicitly selected but no valid `GOSZAKUP_TOKEN` is configured, fail the live request clearly and safely. Do not silently return fixtures while labeling them live.

### 2. Correct list and detail contract

The existing public user journey must work with either source.

Extend the existing source contract only as much as necessary so:

- list requests fetch a bounded set from the selected source;
- detail requests can retrieve the selected lot reliably;
- fixture source still behaves identically;
- live detail does not depend on the selected lot coincidentally being present in an unrelated first page.

Prefer a small explicit method such as `fetchLot(id)` over broad generic abstractions.

For Goszakup ids:

- accept only the normalized id format already created in CP-04;
- validate/parse it safely;
- use an official bounded lookup;
- return the same normalized `Lot` contract;
- return normal 404 semantics when the upstream record is genuinely absent;
- distinguish safe upstream failure from not-found.

Do not leak raw Goszakup DTOs.

### 3. Bounded live list

When live mode is selected, the public `/lots` API must not launch historical crawling.

Use one bounded upstream request. Keep the limit small and deterministic, for example 20–50 records.

Existing local filters may continue to apply after normalization.

Do not claim the result count represents all matching Goszakup tenders unless the upstream query actually provides exhaustive semantics.

### 4. Source-status contract

Add the smallest read-only public metadata contract needed for the frontend to know the active source.

Preferred shape:

`GET /api/v1/lots/source`

Example safe response:

```json
{
  "mode": "fixture",
  "live": false,
  "label": "Demo fixtures"
}
```

or:

```json
{
  "mode": "goszakup",
  "live": true,
  "label": "Goszakup"
}
```

Never return:

- token presence details;
- token values;
- backend URLs;
- secret/config internals.

If an even smaller existing mechanism already provides this information safely, reuse it instead of adding a new endpoint.

### 5. Frontend trust indicator

Update `/lots` so the existing hard-coded “Тестовые данные” statement is no longer misleading.

The page must visibly distinguish:

- **DEMO / FIXTURE** mode — clearly say results are synthetic/test data;
- **LIVE / GOSZAKUP** mode — clearly say results come from Goszakup and are retrieved live/read-only.

Keep the UI simple. No design-system work in this checkpoint.

The detail page should also make source identity clear using existing `lot.source` / source link.

### 6. Failure behavior

Live upstream failures must not expose secrets or stack traces.

When the selected source is live and Goszakup is unavailable/auth fails:

- backend returns an appropriate safe failure;
- frontend shows a useful temporary-unavailable message;
- frontend must **not** silently display fixtures as if they were live.

Fixture mode must remain independent of Goszakup availability.

### 7. Deterministic tests

All CI tests must pass without network access and without a real token.

Cover at minimum:

- default source = fixture;
- explicit fixture selection;
- explicit goszakup selection;
- invalid `TENDER_LOT_SOURCE`;
- live list through mocked/fake Goszakup transport;
- live detail lookup by normalized id;
- malformed/non-Goszakup id behavior in live source;
- upstream not-found;
- upstream failure with no secret leakage;
- source-status endpoint;
- frontend fixture indicator;
- frontend live indicator;
- frontend live-unavailable state;
- existing filters and health regression.

Reuse current tooling and CP-04 fixtures/fakes where possible.

### 8. Optional real live verification

If `GOSZAKUP_TOKEN` is available in the Arena environment, perform a bounded live smoke:

1. run backend in `TENDER_LOT_SOURCE=goszakup`;
2. fetch `/api/v1/lots`;
3. confirm at least one normalized live lot if upstream returns data;
4. open/fetch that lot through `/api/v1/lots/[id]`;
5. verify source-status says live;
6. verify no token appears anywhere.

If the token is unavailable, report:

`Live user path: NOT RUN — GOSZAKUP_TOKEN unavailable`

This does not by itself fail the checkpoint.

Do not ask the owner to paste a token into chat, PR, issue, logs, or fixtures.

## Environment/config documentation

Document:

- `TENDER_LOT_SOURCE=fixture|goszakup`
- existing `GOSZAKUP_TOKEN`
- existing optional Goszakup URL/timeout values

Safe examples only.

Local/default developer startup must remain fixture-backed with no secret required.

## Out of scope

Do **not** add:

- PostgreSQL/ORM/migrations;
- cached/persisted Goszakup lots;
- historical import/backfill;
- pagination crawling;
- cron/scheduler/queues;
- Samruk integration;
- scraping/browser automation;
- document downloads;
- OCR/parsing;
- RAG/embeddings/LLM;
- auth/users;
- ranking/scoring/recommendation engine;
- automatic tender classification;
- notification/Telegram/WhatsApp;
- new cloud infrastructure;
- production deployment changes.

## Acceptance criteria

1. Unset source config keeps the application fixture-backed.
2. `TENDER_LOT_SOURCE=fixture` keeps CP-03 behavior.
3. `TENDER_LOT_SOURCE=goszakup` routes the existing lot service through the CP-04 adapter.
4. Live list is bounded and uses the existing normalized `Lot` contract.
5. A live list result can be opened reliably through `/lots/[id]`.
6. Live detail uses an official documented bounded lookup; no page scan or HTML scraping.
7. Source status is available to frontend without exposing secrets/config internals.
8. `/lots` visibly distinguishes fixture vs live data.
9. Goszakup failure never silently falls back to fixtures in live mode.
10. Fixtures work even when Goszakup is unreachable or tokenless.
11. Existing filters remain functional.
12. Existing health behavior remains functional.
13. `pnpm format:check` passes.
14. `pnpm lint` passes.
15. `pnpm typecheck` passes.
16. `pnpm test` passes.
17. `pnpm test:e2e` passes.
18. `pnpm build` passes.
19. GitHub CI is green.
20. Real live smoke is PASS when a token exists, otherwise explicitly NOT RUN.

## Branch / PR

- Start from current `main`.
- Use the Arena session's dedicated branch.
- Keep the diff limited to this checkpoint.
- Commit and push the exact tested state.
- Open a PR into `main`.
- **Do not merge the PR.**
- Stop after the PR is open and CI is green.

## Deep-change / stop conditions

Stop only the affected portion if completion would require:

- persistence/data migration;
- a new service/repository;
- scraping because no documented Goszakup detail lookup exists;
- a secret crossing into frontend/public output;
- a new infrastructure platform;
- unapproved recurring cost;
- a broad redesign of the public lot contract.

Do not expand scope around the blocker.

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
Source selection: PASS | BLOCKED
Live user path: PASS | NOT RUN | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or start the next checkpoint.
