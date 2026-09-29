# CP-11 — Official procurement documents

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`.

Reuse the existing CP-08 procurement identity, CP-10 lot detail page, current Goszakup client/config/error handling, and current fixture/live source boundary.

This checkpoint authorizes one narrowly bounded extension: discover and expose official procurement-document metadata/links for a selected lot/announcement when the official Goszakup interfaces provide a documented machine-readable path.

Do not create a new repository, persistence layer, downloader service, object storage, background worker, OCR pipeline, AI layer, or document cache.

## Objective

Move the operator from “this tender is worth attention” to “these are the official source documents I need to inspect”.

On a selected lot, the operator should be able to see the available official procurement documents and open the source file/page without leaving the Tender Assistant decision flow.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-08-DECISION-GRADE-TENDER-DETAIL.md`
6. `docs/checkpoints/CP-10-OPERATOR-SHORTLIST.md`
7. this checkpoint

Use the smallest sufficient correct change.

## Mandatory source reconnaissance

Before changing the public contract, inspect the current official Goszakup OWS v3 schema/help and any documented official endpoint used to obtain procurement-document metadata for a lot or its announcement.

Do not guess field names, URL templates, attachment IDs, or document types.

Record in code/tests/docs which documented source is used.

If no documented machine-readable document path can be verified:

- do not scrape HTML as a silent fallback;
- do not fabricate fixture/live parity for an unproven source contract;
- stop the live-source portion as `PARTIAL` or `BLOCKED`;
- preserve any safe source-reconnaissance evidence;
- do not begin CP-12.

## Source boundary

Prefer the existing Goszakup client/configuration and authentication boundary.

A new read-only request is allowed only when required by the verified official document source.

Rules:

- read-only;
- bounded to the selected lot/announcement;
- no historical crawl;
- no pagination loop unless the official endpoint itself returns a bounded document list for one selected procurement;
- no N+1 calls from the list page;
- document lookup belongs to detail only;
- token stays backend-only;
- upstream failures map through existing safe error handling;
- no secrets or signed/private tokens may be returned to frontend.

## Public contract

If the official source supports document metadata, add one detail-only field:

```ts
documents: Array<{
  id: string;
  name: string;
  type: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sourceUrl: string;
}>
```

Rules:

- `id` must be stable from official source identity; do not hash arbitrary display text when a real source ID exists;
- `name` must come from official metadata or a source-provided filename;
- `type` only when the source provides a documented semantic type; otherwise `null`;
- `mimeType` and `sizeBytes` only when explicitly provided or safely derivable from official response metadata; otherwise `null`;
- `sourceUrl` must point to an official Goszakup source page/file URL supported by the verified contract;
- missing metadata remains `null`;
- no synthetic “technical specification” labels based only on filename guesses.

If the verified source contract has materially different fields, keep the public contract minimal and document the justified mapping before implementation.

## Fixture contract

Fixtures may include deterministic document metadata only after the live/source contract is verified.

Fixture documents must be explicitly synthetic and use safe non-secret URLs.

Cover at minimum:

- multiple documents;
- one document with partial metadata;
- no documents.

## Frontend detail

Add a compact `Документы закупки` section to `/lots/[id]`.

Show:

- document name;
- type if known;
- size/type metadata when known;
- official-source link.

Behavior:

- empty list => clear `Документы не указаны источником` state;
- upstream document lookup failure must not silently show an empty successful state;
- preserve CP-08 official procurement data, CP-09 timing and CP-10 actionability;
- no inline file parser, previewer, OCR or AI summary.

The list page must not fetch documents.

## Security and URL rules

- Never expose `GOSZAKUP_TOKEN`.
- Never proxy arbitrary user-controlled URLs.
- Only return/open URLs produced from the verified official source contract.
- Do not persist downloaded bytes.
- Do not follow unbounded redirect chains.
- Do not log authorization headers or sensitive query tokens.

## Tests

All CI tests remain offline and tokenless.

After the source contract is verified, cover at minimum:

- official-source response → normalized documents contract;
- missing optional document fields remain `null`;
- multiple documents preserve stable ordering or documented source ordering;
- no documents => empty array;
- malformed/unsupported source record is handled safely;
- live detail performs only the approved bounded lookup;
- list route performs zero document lookup calls;
- token never appears in API response/errors;
- upstream document-source failure follows explicit error behavior and is not mislabeled as “no documents”;
- fixture detail parity;
- CP-08 procurement metadata regression;
- CP-09 timing regression;
- CP-10 actionability regression;
- frontend renders multiple/partial/empty document states;
- official links are rendered only from normalized source metadata;
- health/source regressions remain green.

## Documentation

Update README or existing API documentation with:

- the verified official document source/path;
- the additive detail-only `documents` contract;
- explicit statement that Tender Assistant does not yet parse document contents;
- known source limitations.

Do not create a new documentation subsystem.

## Out of scope

Do **not** add:

- document-byte storage;
- database;
- object storage;
- caching layer;
- bulk downloader;
- scheduler/background jobs;
- OCR;
- PDF/DOC/XLS content parsing;
- AI/LLM/RAG;
- requirement extraction;
- document classification by model;
- application-package generation;
- Samruk documents;
- authentication/users;
- deployment/infrastructure changes.

## Acceptance criteria

1. Official document source is verified before public contract implementation.
2. No field/endpoint is invented.
3. Detail can expose official procurement-document metadata/links when supported by the verified source.
4. List page never performs document lookups.
5. Lookup is bounded to one selected procurement.
6. Fixture/live mapping shares one normalized document contract.
7. Missing fields remain explicit `null`.
8. Empty and upstream-failure states are distinct.
9. Goszakup token remains backend-only.
10. No document bytes are persisted.
11. CP-08/09/10 behavior remains unchanged.
12. No OCR/AI/parser infrastructure is introduced.
13. `pnpm format:check` passes.
14. `pnpm lint` passes.
15. `pnpm typecheck` passes.
16. `pnpm test` passes.
17. `pnpm test:e2e` passes.
18. `pnpm build` passes.
19. GitHub CI is green.

## Branch / PR

- Start from current `main`.
- Use the Arena session dedicated branch.
- Keep the diff limited to CP-11.
- Commit and push the exact tested state.
- Open one PR into `main`.
- **Do not merge the PR.**
- Stop after PR is open and CI is green, or after a truthfully evidenced source-contract blocker is reached.

## Deep-change / stop conditions

Stop the affected portion if implementation would require:

- undocumented HTML scraping;
- persistence/schema migration;
- object storage;
- new service/repository;
- OCR/AI/RAG;
- a generic ingestion subsystem;
- breaking public API changes;
- unapproved recurring cost.

Continue safe reconnaissance and bounded implementation that remain inside this checkpoint.

## Evidence / final report

Return only:

```text
RESULT: PASS | BLOCKED | PARTIAL
Branch: ...
Commit: ...
PR: ...
Source contract: VERIFIED | NOT VERIFIED
Documents path: ...
Tests: ...
Build: ...
CI: ...
Changed: ...
Remaining: ...
```

If complete, do not begin CP-12.
