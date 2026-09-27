# CP-03 — Lots vertical slice

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel service or repository.

## Objective

Implement the first real user-facing vertical slice of Tender Assistant:

**list tenders → filter → open tender card → understand whether it is relevant for participation.**

This checkpoint is intentionally small. It must prove the product flow before adding real ingestion, databases, OCR, RAG, LLMs, or cloud infrastructure.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. this checkpoint

Follow the smallest sufficient change rule. Reuse the existing NestJS + Next.js bootstrap and existing test/CI setup.

## Product constraints for this checkpoint

Current business targeting:

- tenders up to **500,000 KZT**;
- geography: **Almaty city**;
- preference signal: **Alatau district**;
- furniture-related procurement;
- primarily **LDSP / laminated chipboard** furniture;
- clearly metallic cabinets should be treated as non-target examples.

Do not hard-code the architecture to a single furniture subtype. These rules are initial product filters, not a permanent ontology.

## Scope

### Backend

Create the minimum domain model needed for a tender/lot list and detail view.

Expose API endpoints sufficient for:

- listing lots;
- fetching one lot by id;
- filtering by maximum amount;
- filtering by region/district;
- text search.

Use deterministic fixtures/in-memory data for this checkpoint.

The same service/API contract must later be reusable by real ingestion. Do not create a demo-only frontend data path.

Minimum fields exposed to the user:

- id;
- source;
- external/source URL;
- title / procurement subject;
- customer;
- amount;
- region;
- district when available;
- bid deadline;
- short description or relevant text if useful for search.

### Frontend

Implement:

- `/lots`
- `/lots/[id]`

`/lots` must:

- show deterministic fixture tenders;
- support text search;
- support max amount filter;
- support Almaty / district filtering;
- link each row/card to tender detail.

`/lots/[id]` must show the main tender information and a working source link.

Keep UI simple and mobile-friendly.

Do not add a heavy UI framework unless the existing stack cannot reasonably implement the required screens.

## Fixture expectations

Include enough deterministic records to prove positive and negative behavior, including at least:

- a furniture tender in Almaty under 500,000 KZT;
- an Alatau district tender;
- a tender over 500,000 KZT;
- a non-Almaty tender;
- a clearly metallic-cabinet example;
- an LDSP furniture example.

Fixtures are test data only, but they must flow through the same backend service/API used by the frontend.

## Out of scope

Do **not** add in this checkpoint:

- PostgreSQL / Cloud SQL;
- ORM or migrations;
- authentication/users/organizations;
- object storage;
- real Goszakup ingestion;
- Samruk-Kazyna ingestion;
- scraping;
- background jobs/queues;
- OCR;
- document parsing;
- embeddings;
- pgvector/Qdrant;
- RAG;
- LLM integration;
- new cloud infrastructure;
- deployment architecture changes.

If any of these become necessary, treat that portion as a deep-change/scope expansion and stop that portion.

## Acceptance criteria

1. `/lots` renders fixture tenders through the backend API.
2. `maxAmount=500000` (or equivalent API contract) filters correctly.
3. Text search works deterministically.
4. Almaty filtering works.
5. Alatau district filtering works.
6. A list item opens `/lots/[id]`.
7. Tender detail shows the required fields and source link.
8. API tests cover list/detail and critical filter behavior.
9. Frontend behavior has appropriate regression coverage using the project's existing test approach.
10. Existing health behavior remains intact.
11. `pnpm format:check` passes.
12. `pnpm lint` passes.
13. `pnpm typecheck` passes.
14. `pnpm test` passes.
15. `pnpm test:e2e` passes.
16. `pnpm build` passes.
17. GitHub CI is green.

## Branch / PR

- Start from current `main`.
- Use a dedicated Arena branch.
- Keep the diff limited to this checkpoint.
- Commit and push the exact tested state.
- Open a PR into `main`.
- **Do not merge the PR.**
- Stop after the PR is open and CI is green.

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
Changed: ...
Remaining: ...
```

If complete, do not invent or start the next checkpoint.
