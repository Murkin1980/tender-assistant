# CP-07 — Deterministic tender triage v1

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the existing normalized `Lot` model, CP-06 filters, current live/fixture source boundary, and existing UI. Do not create a new repository, service, scoring engine, or AI pipeline.

## Objective

Add a small, transparent suitability layer that helps the operator answer:

**“Стоит ли мне смотреть этот тендер дальше?”**

For every normalized lot, derive one of:

- `MATCH` — fits the current hard profile and has positive furniture/LDSP evidence;
- `REVIEW` — not clearly excluded, but evidence is incomplete/ambiguous;
- `EXCLUDE` — violates a current hard rule.

Every decision must include human-readable reasons.

This checkpoint is deterministic triage only. It is not an AI recommendation engine and must not claim legal/commercial certainty.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-05-CONTROLLED-LIVE-GOSZAKUP-USER-PATH.md`
6. `docs/checkpoints/CP-06-TARGETED-LIVE-GOSZAKUP-SEARCH.md`
7. this checkpoint

Use the smallest sufficient change and preserve all existing source/filter behavior.

## Current business profile

For v1, use only already-approved business rules:

- max amount: **500,000 KZT**;
- target geography: **Almaty city**;
- preferred district: **Alatau district** when district data is actually available;
- target category: furniture;
- preferred material signal: **LDSP / ЛДСП**;
- clearly metallic cabinets are non-target.

Do not invent supplier capacity, margin, legal eligibility, delivery feasibility, procurement-method eligibility, or document-compliance rules in this checkpoint.

## Public contract change

This checkpoint explicitly authorizes one additive public contract extension.

Add a derived field to the public lot response:

```ts
assessment: {
  status: 'MATCH' | 'REVIEW' | 'EXCLUDE';
  reasons: string[];
}
```

This is additive only. Do not rename/remove existing fields.

The assessment must be derived server-side from the normalized `Lot`; raw source DTOs must not leak into it.

## Triage rules

Implement one pure deterministic evaluator.

### EXCLUDE

A lot is `EXCLUDE` when any verified hard exclusion applies:

1. `amount > 500000`;
2. region is known and is not Almaty;
3. title/description contains a narrow, explicit metallic-cabinet signal.

Metallic-cabinet detection must be intentionally conservative.

Acceptable v1 examples may include obvious phrases such as:

- `шкаф металлический`
- `металлический шкаф`
- `металлические шкафы`

Kazakh equivalents may be added only when you are confident they mean the same thing.

Do not broadly exclude any lot merely because it contains the word “metal”.

### MATCH

A lot is `MATCH` only when:

- it is not excluded;
- amount is <= 500000;
- region is Almaty;
- and there is positive target evidence in title/description.

Positive evidence should be narrow and deterministic, for example:

- `ЛДСП` / common case-insensitive forms;
- clear furniture terms such as `мебель`, `шкаф`, `стол`, `тумба`, `кухня` when they do not trigger a metallic exclusion.

Do not build a large taxonomy.

### REVIEW

Use `REVIEW` when the lot is not excluded but there is insufficient evidence for `MATCH`.

Examples:

- amount and city fit, but text is too generic;
- region/district data is missing or ambiguous;
- furniture relevance is uncertain.

### Alatau preference

Alatau district is a **positive reason only**, not a hard requirement.

When `district` is actually available and equals Alatau district, add a reason such as “Preferred district: Alatau”.

Do not infer district from text or fabricate it from incomplete KATO data.

## Reason contract

Reasons must be short, stable, and understandable.

Examples:

- `Amount is within 500,000 KZT`
- `Region is Almaty`
- `LDSP signal found`
- `Furniture signal found`
- `Preferred district: Alatau`
- `Amount exceeds 500,000 KZT`
- `Region is outside Almaty`
- `Metallic cabinet signal found`
- `Insufficient evidence for automatic match`

Do not expose regexes, internal codes, raw KATO values, or implementation details.

## Backend

Implement the evaluator as a small pure function/module near the tender domain.

Requirements:

- no network access;
- no new dependency;
- deterministic output;
- stable reason ordering;
- case-insensitive text matching;
- no mutation of input lot;
- easy unit testing.

Integrate it into the existing list/detail response path so both fixture and Goszakup lots receive the same assessment.

Do not duplicate the evaluator in controller/source/frontend.

## Frontend

Update `/lots` and `/lots/[id]` minimally.

List cards must show a compact status indicator:

- `MATCH`
- `REVIEW`
- `EXCLUDE`

Detail page must show the reasons.

Add a simple status filter to the existing GET form:

- all;
- MATCH;
- REVIEW;
- EXCLUDE.

Keep the URL shareable.

Do not add sorting/ranking in this checkpoint.

Do not hide excluded lots by default; transparency is more important than silently removing them.

## Interaction with existing filters

Existing text/amount/region/district filters continue to work.

Assessment is computed after normalization and must not change source selection.

The assessment status filter may be applied locally after assessment generation.

Do not push assessment status to Goszakup.

Do not modify CP-06 upstream filter semantics.

## Deterministic tests

All tests remain offline and tokenless.

Cover at minimum:

- amount >500000 => EXCLUDE;
- non-Almaty known region => EXCLUDE;
- obvious metallic cabinet => EXCLUDE;
- LDSP + Almaty + <=500000 => MATCH;
- furniture keyword + Almaty + <=500000 => MATCH;
- generic/ambiguous text => REVIEW;
- missing district does not exclude;
- Alatau adds a positive reason only;
- stable reason ordering;
- mixed case text;
- list API returns assessment;
- detail API returns assessment;
- assessment status filter;
- fixture regression;
- mocked live Goszakup regression;
- source-status regression;
- health regression;
- frontend list badges;
- frontend detail reasons;
- frontend status filter preserves existing query parameters.

## UI wording

Add a short note near the list:

`Статус — автоматический предварительный отбор по простым правилам. Финальное решение принимает оператор.`

Do not say “AI recommendation”, “recommended tender”, “guaranteed suitable”, or similar.

## Out of scope

Do **not** add:

- LLM/AI classification;
- embeddings/RAG;
- probabilistic scoring;
- numeric ranking;
- margin/profit estimation;
- supplier qualification checks;
- legal eligibility conclusions;
- document OCR/parsing;
- persistence/database;
- user feedback learning;
- notifications;
- new Goszakup queries;
- Samruk integration;
- new infrastructure;
- deployment changes.

## Acceptance criteria

1. Every public lot response contains `assessment.status` and `assessment.reasons`.
2. Existing fields remain backward-compatible.
3. Fixture and live lots use the same evaluator.
4. Hard exclusions are conservative and deterministic.
5. MATCH requires positive target evidence.
6. Ambiguous lots become REVIEW rather than forced MATCH/EXCLUDE.
7. Alatau is a preference reason, not a hard gate.
8. List page visibly shows the status.
9. Detail page shows reasons.
10. GET status filter works and remains shareable.
11. Existing filters remain green.
12. LIVE/DEMO trust indicator remains green.
13. No AI/scoring/ranking is introduced.
14. `pnpm format:check` passes.
15. `pnpm lint` passes.
16. `pnpm typecheck` passes.
17. `pnpm test` passes.
18. `pnpm test:e2e` passes.
19. `pnpm build` passes.
20. GitHub CI is green.

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

- AI/LLM;
- a new repository/service;
- persistence/schema migration;
- broad ontology/taxonomy;
- a breaking public API change;
- new infrastructure;
- unapproved recurring cost.

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
Triage rules: PASS | PARTIAL | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or begin the next checkpoint.
