# CP-06 — Targeted live Goszakup search

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the existing CP-03 filters, CP-04 Goszakup client/mapper, and CP-05 live source path. Do not add a new service, repository, persistence layer, or search engine.

## Objective

Make LIVE mode materially useful for the current Tender Assistant business profile by pushing supported filters into Goszakup before local post-filtering.

Target flow:

**user filters → documented Goszakup filter translation → one bounded upstream query → normalization → local verification/post-filter → /lots results**

The checkpoint must reduce the current weakness where live mode receives an arbitrary first page and only then filters locally.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-04-GOSZAKUP-LIVE-SOURCE-ADAPTER.md`
6. `docs/checkpoints/CP-05-CONTROLLED-LIVE-GOSZAKUP-USER-PATH.md`
7. this checkpoint

Use the smallest sufficient change and preserve existing fixture behavior.

## Product profile

Current target:

- furniture procurement;
- amount up to **500,000 KZT**;
- **Almaty city**;
- preference: **Alatau district** when data allows;
- primarily LDSP / laminated chipboard furniture;
- clearly metallic cabinets are non-target.

This checkpoint is search narrowing, not a recommendation/ranking engine.

## Source-of-truth rule

Before adding any upstream filter mapping, inspect the current official Goszakup OWS v3 GraphQL schema/docs for `LotsFiltersInput`.

Only translate a public filter when the corresponding upstream field and semantics are documented.

Do not guess field names, enum/status ids, KATO codes, amount semantics, or text-search behavior.

If an existing CP-04 type contains a field that was not actually verified for this use, verify it against the official schema before relying on it.

When an existing UI filter cannot be represented safely upstream, leave it as local post-filtering and document that limitation.

## Scope

### 1. Pass filters to the source

Extend the existing `LotSource.fetchLots` contract minimally so the source can receive normalized `LotFilters` (or an equivalent narrow query object).

Rules:

- Fixture source applies current behavior deterministically.
- Goszakup source receives the user filters and translates only supported parts upstream.
- `TenderService` must not duplicate two separate filtering implementations.
- Keep one final local post-filter step to enforce the public contract after normalization, even when some predicates were pushed upstream.

Do not build a generic query DSL.

### 2. Goszakup filter translator

Create a small pure translator from the existing public lot filters to the verified subset of `GoszakupLotsFilter`.

At minimum investigate and use, when officially supported:

- text/name/description search;
- amount upper bound or documented amount range semantics;
- location/KATO for Almaty.

For district:

- only push Alatau district upstream if the official source contract provides a verified district/KATO representation that matches the public filter;
- otherwise keep district as local-only and state why.

No fabricated KATO ids.

### 3. Furniture-target preset

Add one small user-facing preset/action for the current business profile, reusing existing filters rather than creating a scoring system.

Preferred behavior:

A link/button such as **“Наш профиль”** applies:

- `maxAmount=500000`;
- `region=Алматы`;
- a furniture/LDSP-oriented text query only if one deterministic query can be justified.

Do not hide the actual applied filters. The URL must remain shareable/readable.

Do not add AI classification.

If a single text query would exclude obvious valid furniture cases, keep the preset limited to amount + region and leave text search manual.

### 4. Non-target metallic cabinet handling

Do not create a broad ontology or classifier.

Add at most a small deterministic exclusion helper only if it can be expressed transparently and tested, for example exact/obvious Russian/Kazakh phrases meaning metallic cabinet.

If this risks false exclusions or materially expands scope, do not implement it in CP-06. Record it as remaining work.

The system must not silently claim that all shown results are suitable tenders.

### 5. Bounded result strategy

One user list request must remain bounded.

Do not introduce historical crawling, unbounded pagination, or background ingestion.

If pushing filters upstream returns fewer results, that is acceptable.

If a slightly larger bounded limit is needed to compensate for local post-filtering, keep it within the existing official/source bounds and justify it in code/tests. Do not fetch multiple pages in this checkpoint.

### 6. Result transparency

LIVE UI must continue to say that results are a bounded live selection, not an exhaustive list.

When filters are active, show the applied filter state through the existing form/URL.

If some filters are local-only, the UI does not need technical implementation details, but must not state that Goszakup itself supplied an exhaustive matching set.

### 7. Deterministic tests

All CI tests remain offline and tokenless.

Cover at minimum:

- filter forwarding from service to source;
- fixture source regression;
- Goszakup translator with each verified supported filter;
- unsupported/local-only filter does not generate invented upstream fields;
- combined target-profile filters;
- upstream response still receives final local post-filtering;
- text search regression;
- amount regression;
- region regression;
- district regression;
- live errors remain 503 and never fall back to fixtures;
- preset URL/fields on frontend;
- source-status and health regressions.

Use existing fake/mocked Goszakup transport.

### 8. Optional live verification

If a real `GOSZAKUP_TOKEN` and network access exist, run bounded comparisons such as:

- no filters;
- `maxAmount=500000`;
- `region=Алматы`;
- combined target-profile request.

Capture only non-secret evidence such as returned counts and normalized ids/titles.

Do not claim recall/completeness from a bounded query.

If unavailable, report:

`Targeted live probe: NOT RUN — token/network unavailable`

This does not fail the checkpoint.

## Out of scope

Do **not** add:

- PostgreSQL / ORM / migrations;
- historical ingestion;
- pagination crawling;
- background jobs;
- materialized cache;
- RAG / embeddings / LLM;
- semantic search;
- tender scoring or ranking;
- automatic suitability verdicts;
- document download/OCR;
- Samruk integration;
- Telegram/WhatsApp notifications;
- authentication;
- new infrastructure;
- deployment changes.

## Acceptance criteria

1. Existing fixture mode remains green.
2. Existing LIVE mode remains green.
3. Public filters reach the `LotSource` boundary instead of only post-filtering after an unfiltered source read.
4. Goszakup translates only officially verified filter fields.
5. At least one useful current filter is pushed upstream in live mode.
6. Unsupported filters remain safely local-only.
7. A final local filter preserves public API semantics.
8. One bounded upstream list request per public list request; no crawling.
9. “Наш профиль” (or equivalent) applies the current amount/Almaty profile transparently.
10. No AI classifier/ranker is introduced.
11. UI continues to identify LIVE vs DEMO correctly.
12. Live result wording does not imply completeness.
13. `pnpm format:check` passes.
14. `pnpm lint` passes.
15. `pnpm typecheck` passes.
16. `pnpm test` passes.
17. `pnpm test:e2e` passes.
18. `pnpm build` passes.
19. GitHub CI is green.
20. Optional real targeted probe is PASS when credentials/network exist, otherwise NOT RUN.

## Branch / PR

- Start from current `main`.
- Use the Arena session's dedicated branch.
- Keep the diff limited to this checkpoint.
- Commit and push the exact tested state.
- Open a PR into `main`.
- **Do not merge the PR.**
- Stop after PR is open and CI is green.

## Deep-change / stop conditions

Stop only the affected portion if the task would require:

- undocumented Goszakup filter semantics;
- fabricated KATO/status ids;
- multi-page crawling;
- persistence;
- new service/repository;
- broad public API redesign;
- paid/new infrastructure;
- secrets in public/client code.

Continue safe parts that remain inside checkpoint scope.

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
Filter pushdown: PASS | PARTIAL | BLOCKED
Targeted live probe: PASS | NOT RUN | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or begin the next checkpoint.
