# CP-08 — Decision-grade tender detail

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the existing normalized `Lot` model, Goszakup mapper/query, CP-07 assessment, and current list/detail UI.

Do not create a new repository, service, persistence layer, OCR pipeline, RAG layer, or document-processing subsystem.

## Objective

Make the tender detail page useful enough for an operator to decide whether a `MATCH` or `REVIEW` lot deserves manual follow-up.

Add only verified, source-backed procurement metadata that can be obtained from the existing bounded Goszakup lot query (or from a minimal documented extension of that same official read-only query).

Target detail should answer, when data is available:

- What is the official lot number?
- What is the announcement/procurement number?
- Who is the customer and what is their BIN?
- When was the tender published?
- When does application acceptance end?
- What is the procurement/procedure method?
- What is the current official lot/procurement status?
- What source record should the operator open?

This checkpoint is metadata enrichment and presentation only.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-04-GOSZAKUP-LIVE-SOURCE-ADAPTER.md`
6. `docs/checkpoints/CP-05-CONTROLLED-LIVE-GOSZAKUP-USER-PATH.md`
7. `docs/checkpoints/CP-07-DETERMINISTIC-TENDER-TRIAGE.md`
8. this checkpoint

Use the smallest sufficient change and preserve all existing behavior.

## Source-of-truth rule

Before adding any field, inspect the current official Goszakup OWS v3 GraphQL schema/docs.

Only expose fields whose meaning is documented and whose mapping is unambiguous.

Do not infer:

- procurement method from free text;
- status from unrelated numeric codes unless the official schema/documentation resolves them;
- customer BIN from description if a dedicated upstream field exists;
- publication/deadline dates from unrelated timestamps;
- announcement number from a different identifier;
- district from KATO unless already verified.

If a desired field cannot be safely mapped from the official schema, omit it from CP-08 and record it under `Remaining`.

## Public contract

This checkpoint authorizes additive metadata on the public `Lot` contract.

Prefer a compact nested shape to avoid further flattening:

```ts
procurement: {
  lotNumber: string | null;
  announcementNumber: string | null;
  customerBin: string | null;
  publishedAt: string | null;
  procurementMethod: string | null;
  officialStatus: string | null;
}
```

If the repository has a clearly better existing contract shape, use it, but keep it additive and source-neutral.

Rules:

- existing fields remain unchanged;
- missing data is represented as `null` (or the repository's established empty-value convention if already canonical);
- no fabricated placeholders in backend responses;
- fixture and live lots use the same public contract;
- raw Goszakup DTOs/codes must not leak into public responses unless that code itself is the documented human-meaningful value.

## Goszakup query and mapper

Extend the existing bounded Goszakup query only as needed.

Current fields already present in CP-04 include:

- `lotNumber`;
- `customerBin`;
- `trdBuyNumberAnno`;
- `TrdBuy.publishDate`;
- `TrdBuy.endDate`;
- customer identity fields.

Before using procurement method or official status, confirm their documented OWS v3 fields and return values.

Requirements:

- one existing bounded query path remains sufficient;
- no second request per list row;
- no N+1 detail enrichment;
- no pagination/crawling;
- mapper remains deterministic and pure;
- missing/invalid dates remain missing rather than guessed;
- customer BIN becomes a dedicated metadata field; do not rely on embedding it only in `description`.

If the old description currently appends `БИН заказчика`, remove that duplication only if doing so does not break an approved public behavior/test. Prefer one canonical field over duplicated metadata.

## Fixture parity

Update deterministic fixtures so all relevant display states are testable:

- metadata fully present;
- some optional metadata missing;
- REVIEW/EXCLUDE/MATCH behavior remains unchanged.

Do not make fixtures pretend to be real Goszakup records.

## Backend behavior

List and detail endpoints continue returning the same assessed lots, now with additive procurement metadata.

Do not change:

- source selection;
- CP-06 filter pushdown;
- CP-07 assessment semantics;
- error handling;
- 404 behavior;
- LIVE/DEMO trust status.

No new endpoint is required unless an existing architectural constraint makes it strictly necessary.

## Frontend detail page

Enhance `/lots/[id]` with a compact `Данные закупки` section.

Show when available:

- lot number;
- announcement/procurement number;
- customer BIN;
- publication date/time;
- deadline;
- procurement method;
- official status.

Rules:

- clearly render unavailable fields as `Не указано` or omit them consistently;
- do not show raw internal enum/code values as though they are human labels;
- preserve assessment status/reasons above or near this metadata;
- preserve source link;
- preserve LIVE/DEMO notice;
- mobile-friendly layout;
- no new UI framework.

The list page should remain compact. Do not add every new metadata field to each list card.

At most, add one high-value compact item to list cards if it materially improves scanning (for example deadline or official lot number), but this is optional.

## Time handling

All upstream timestamps remain stored/transmitted as ISO-8601.

Frontend display uses the established Almaty timezone handling.

Do not rewrite timestamps or assume a timezone when upstream data is ambiguous; only normalize when the parsed timestamp is valid.

## Deterministic tests

All CI tests remain offline and tokenless.

Cover at minimum:

- Goszakup mapper maps lot number;
- announcement number mapping;
- customer BIN mapping;
- published date mapping;
- deadline regression;
- verified procurement method mapping if implemented;
- verified official status mapping if implemented;
- missing optional metadata remains null/missing, not invented;
- invalid date does not fabricate a timestamp;
- fixtures satisfy the additive contract;
- list API contains procurement metadata;
- detail API contains procurement metadata;
- CP-07 assessment remains unchanged for equivalent input;
- mocked live Goszakup path returns metadata;
- frontend detail renders all available metadata;
- frontend handles missing optional metadata;
- source-status and health regressions.

## Documentation

Update README or existing API documentation with the additive metadata contract and clarify:

- fields are source-backed;
- optional fields may be missing;
- triage is still a preliminary deterministic assessment;
- the source link remains the authoritative place for final tender verification.

Do not create a new documentation system.

## Out of scope

Do **not** add:

- tender document download;
- PDF/DOC/XLS parsing;
- OCR;
- qualification-requirement extraction;
- contract history;
- complaints;
- supplier analysis;
- price/margin calculation;
- LLM/RAG;
- AI summaries;
- database/persistence;
- historical import;
- notifications;
- authentication;
- Samruk integration;
- new infrastructure;
- deployment changes.

## Acceptance criteria

1. Public lot contract gains additive procurement metadata.
2. Existing public fields remain backward-compatible.
3. Goszakup metadata comes only from documented official fields.
4. Fixture and live sources satisfy the same contract.
5. Customer BIN is available as structured metadata when upstream provides it.
6. Lot/announcement numbers are correctly differentiated.
7. Publication/deadline timestamps are mapped safely.
8. Procurement method/status are included only if their official semantics are verified.
9. Missing fields are not fabricated.
10. Detail UI exposes available procurement metadata clearly.
11. CP-07 assessment behavior remains unchanged.
12. CP-06 filter behavior remains unchanged.
13. LIVE/DEMO trust indicator remains unchanged.
14. No N+1 enrichment requests are introduced.
15. `pnpm format:check` passes.
16. `pnpm lint` passes.
17. `pnpm typecheck` passes.
18. `pnpm test` passes.
19. `pnpm test:e2e` passes.
20. `pnpm build` passes.
21. GitHub CI is green.

## Branch / PR

- Start from current `main`.
- Use the Arena session's dedicated branch.
- Keep the diff limited to this checkpoint.
- Commit and push the exact tested state.
- Open a PR into `main`.
- **Do not merge the PR.**
- Stop after PR is open and CI is green.

## Deep-change / stop conditions

Stop only the affected portion if implementation would require:

- undocumented upstream fields/semantics;
- a second upstream request per row;
- document parsing/OCR;
- persistence/schema migration;
- a new service/repository;
- breaking public API changes;
- new infrastructure;
- unapproved recurring cost.

Continue safe metadata fields that remain inside the checkpoint.

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
Metadata mapping: PASS | PARTIAL | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or begin the next checkpoint.
