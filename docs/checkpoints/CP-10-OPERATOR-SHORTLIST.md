# CP-10 — Operator shortlist

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`.

Reuse the existing normalized `Lot`, CP-07 `assessment`, CP-08 `procurement`, CP-09 `timing`, current list/detail API, current URL-backed filters, and existing frontend components.

Do not create a new repository, service, worker, scheduler, persistence layer, notification system, AI layer, or new procurement query.

## Objective

Turn the already available tender facts into one deterministic operator action state so the user can immediately see what requires attention now.

The operator should be able to answer:

- Which tenders should I take into work now?
- Which tenders require manual verification?
- Which tenders should I skip?
- Why did the system put the tender into that bucket?
- Can I filter the list by this operator state?

This checkpoint is a deterministic composition of CP-07 and CP-09 only.

It must not claim to make a legal, procurement, or official eligibility decision.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-07-DETERMINISTIC-TENDER-TRIAGE.md`
6. `docs/checkpoints/CP-08-DECISION-GRADE-TENDER-DETAIL.md`
7. `docs/checkpoints/CP-09-ACTIONABLE-TENDER-WINDOW.md`
8. this checkpoint

Use the smallest sufficient change.

## Product rule

Derive one operator state from the already approved dimensions:

- CP-07 `assessment.status`: `MATCH | REVIEW | EXCLUDE`
- CP-09 `timing.status`: `OPEN_BY_DEADLINE | CLOSED_BY_DEADLINE | DEADLINE_UNKNOWN`

New state:

- `TAKE` — candidate to take into work now;
- `REVIEW` — requires manual verification;
- `SKIP` — do not spend operator time on it now.

UI copy may be Russian:

- `TAKE` → `Брать в работу`
- `REVIEW` → `Проверить`
- `SKIP` → `Не брать`

## Deterministic precedence

Apply rules in this exact order:

1. If `assessment.status === EXCLUDE` → `SKIP`.
2. Else if `timing.status === CLOSED_BY_DEADLINE` → `SKIP`.
3. Else if `assessment.status === REVIEW` → `REVIEW`.
4. Else if `timing.status === DEADLINE_UNKNOWN` → `REVIEW`.
5. Else if `assessment.status === MATCH` and `timing.status === OPEN_BY_DEADLINE` → `TAKE`.
6. Any impossible/unexpected combination must fail safely to `REVIEW`, not `TAKE`.

This precedence is intentional:

- exclusion wins over timing;
- an expired deadline wins over an otherwise matching profile;
- unknown information never becomes `TAKE`.

Do not change CP-07 rules to achieve this.

Do not change CP-09 timing rules to achieve this.

## Public contract

Authorize one additive derived field on every public lot response:

```ts
actionability: {
  status: 'TAKE' | 'REVIEW' | 'SKIP';
}
```

No duplicated human-readable reason strings are required in the backend contract.

The UI should explain the result by reusing already available facts:

- CP-07 `assessment.reasons`;
- CP-09 timing state / remaining duration;
- existing amount, region, district, title, description and procurement metadata where already displayed.

Do not invent additional scoring.

Do not add confidence percentages.

Do not add ranking.

## Evaluator

Implement one pure deterministic evaluator that receives the already derived assessment and timing values.

It must:

- have no network calls;
- have no clock reads;
- have no environment reads;
- have no persistence;
- not mutate inputs;
- return only the operator state.

Use the same evaluator for fixture and live Goszakup lots.

Do not duplicate the decision table in controllers, adapters or frontend code.

## Backend integration

Compute `actionability` after CP-07 assessment and CP-09 timing are available.

Preserve:

- source selection;
- CP-06 upstream filter pushdown;
- CP-07 assessment semantics;
- CP-08 procurement mapping;
- CP-09 timing semantics;
- 400/404/503 behavior;
- fixture/live parity;
- LIVE/DEMO indicator.

## List filter

Extend the existing GET list filter with:

`actionStatus=TAKE|REVIEW|SKIP`

Rules:

- validate on backend;
- repeated value => 400;
- unknown value => 400;
- apply locally after actionability derivation;
- never push `actionStatus` upstream to Goszakup;
- preserve all existing filters and query parameters;
- URL remains shareable.

Frontend options:

- all;
- `Брать в работу`;
- `Проверить`;
- `Не брать`.

## Frontend list

Each lot card should show one compact operator badge in addition to existing CP-07 and CP-09 facts.

Required behavior:

- `TAKE` is visually identifiable as the primary action bucket;
- `REVIEW` clearly indicates manual checking;
- `SKIP` clearly indicates no current operator action;
- do not hide `REVIEW` or `SKIP` by default;
- do not remove the existing assessment/timing information that explains the state.

Add a compact summary above the list when practical:

- count of `TAKE`;
- count of `REVIEW`;
- count of `SKIP`;

but only for the currently loaded bounded result set.

Do not present these counts as the full Goszakup market.

If adding the summary would materially expand the diff, skip it; the filter and per-card state are mandatory, the summary is optional.

## Frontend detail

On the lot detail page show:

- operator state;
- profile assessment;
- deadline-derived state;
- existing official procurement status separately.

The UI must make clear that:

- `Брать в работу` is an internal operational recommendation based on configured rules;
- it is not an official procurement status;
- it is not a legal eligibility conclusion.

## Existing profile

Do not change the approved tender profile in this checkpoint.

Keep the current business rules already represented by CP-07, including the current project constraints such as amount/geography/material/product handling.

If current CP-07 behavior does not fully encode a desired future rule, record that as separate scope; do not silently alter it inside CP-10.

## Tests

All CI tests remain offline and tokenless.

Cover at minimum:

- EXCLUDE + OPEN_BY_DEADLINE => SKIP;
- EXCLUDE + DEADLINE_UNKNOWN => SKIP;
- EXCLUDE + CLOSED_BY_DEADLINE => SKIP;
- MATCH + CLOSED_BY_DEADLINE => SKIP;
- REVIEW + CLOSED_BY_DEADLINE => SKIP;
- REVIEW + OPEN_BY_DEADLINE => REVIEW;
- REVIEW + DEADLINE_UNKNOWN => REVIEW;
- MATCH + DEADLINE_UNKNOWN => REVIEW;
- MATCH + OPEN_BY_DEADLINE => TAKE;
- unexpected combination fails safe to REVIEW if the type boundary can be tested;
- evaluator is pure and does not mutate input;
- fixture list includes actionability;
- fixture detail includes actionability;
- mocked live Goszakup path includes actionability;
- `actionStatus` filter works;
- invalid/repeated `actionStatus` => 400;
- `actionStatus` is never pushed upstream;
- CP-07 regression unchanged;
- CP-08 regression unchanged;
- CP-09 regression unchanged;
- existing filters remain compatible;
- list UI renders all three operator states;
- detail UI keeps operator state, assessment, deadline state and official status distinct;
- existing query parameters survive action filter changes;
- health/source regressions remain green.

## Documentation

Update README or existing API documentation with:

- the additive `actionability` contract;
- the deterministic precedence table;
- the `actionStatus` filter;
- the explicit statement that the state is internal/operator-facing and not official or legal.

Do not create a new documentation subsystem.

## Out of scope

Do **not** add:

- persistence/database;
- saved shortlist;
- favorites;
- task assignment;
- user accounts;
- comments;
- notifications;
- Telegram/WhatsApp/email;
- cron/scheduler;
- background refresh;
- automatic application submission;
- document download or parsing;
- OCR;
- AI/LLM/RAG;
- ranking/scoring;
- confidence score;
- new Goszakup queries;
- Samruk integration;
- deployment/infrastructure changes;
- new dependencies unless strictly required by existing stack limitations.

## Acceptance criteria

1. Every public lot response has additive `actionability.status`.
2. One pure evaluator owns the decision table.
3. Fixture and live lots use the same evaluator.
4. Precedence is exactly as specified.
5. Unknown information never produces `TAKE`.
6. Expired deadline never produces `TAKE`.
7. CP-07 EXCLUDE always produces `SKIP`.
8. Public `actionStatus` filter works.
9. `actionStatus` remains local-only and is never pushed upstream.
10. Existing filters remain compatible.
11. CP-07 behavior is unchanged.
12. CP-08 procurement metadata is unchanged.
13. CP-09 timing behavior is unchanged.
14. List UI shows the operator state.
15. Detail UI distinguishes operator state from official status and deadline state.
16. No persistence, scheduler, notification or AI layer is introduced.
17. `pnpm format:check` passes.
18. `pnpm lint` passes.
19. `pnpm typecheck` passes.
20. `pnpm test` passes.
21. `pnpm test:e2e` passes.
22. `pnpm build` passes.
23. GitHub CI is green.

## Branch / PR

- Start from current `main`.
- Use the Arena session dedicated branch.
- Keep the diff limited to CP-10.
- Commit and push the exact tested state.
- Open one PR into `main`.
- **Do not merge the PR.**
- Stop after PR is open and CI is green.

## Deep-change / stop conditions

Stop only the affected portion if implementation would require:

- persistence/schema migration;
- a new service/repository;
- new infrastructure;
- background scheduling;
- notifications;
- breaking public API changes;
- changes to CP-07 business rules;
- changes to CP-09 timing semantics;
- unapproved recurring cost.

Continue safe work that remains inside checkpoint scope.

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
Actionability rules: PASS | PARTIAL | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or begin CP-11.
