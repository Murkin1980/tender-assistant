# CP-09 — Actionable tender window

Status: APPROVED FOR IMPLEMENTATION

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse the existing normalized `Lot`, CP-07 assessment, CP-08 procurement metadata, current list/detail API, and current frontend filters.

Do not create a new repository, worker, scheduler, notification service, persistence layer, or background process.

## Objective

Make the tender list operationally useful by deriving a transparent time-window state from the already available application deadline.

The operator should be able to answer:

- Is the application deadline still in the future?
- Has the deadline already passed?
- Is the deadline unknown?
- How much time remains when a valid future deadline exists?
- Can I filter the current result set to tenders whose deadline has not passed?

This checkpoint is deterministic deadline handling only.

It must **not** claim that a tender is legally/officially open solely because its deadline is in the future.

## Mandatory first read

Before editing:

1. `AGENTS.md`
2. `docs/governance/SCOPE-CHANGE-CONTROL.md`
3. `README.md`
4. `tender-assistant-spec.md`
5. `docs/checkpoints/CP-07-DETERMINISTIC-TENDER-TRIAGE.md`
6. `docs/checkpoints/CP-08-DECISION-GRADE-TENDER-DETAIL.md`
7. this checkpoint

Use the smallest sufficient change and preserve all existing source/filter behavior.

## Product rule

The source already provides `bidDeadline` when available.

Derive only a deadline state:

- `OPEN_BY_DEADLINE` — valid deadline is in the future;
- `CLOSED_BY_DEADLINE` — valid deadline is in the past or exactly now;
- `DEADLINE_UNKNOWN` — deadline is missing or invalid.

These names are intentionally explicit.

Do **not** rename `OPEN_BY_DEADLINE` to `OPEN`, because official procurement status may differ.

## Public contract

This checkpoint authorizes one additive derived field:

```ts
timing: {
  status: 'OPEN_BY_DEADLINE' | 'CLOSED_BY_DEADLINE' | 'DEADLINE_UNKNOWN';
  deadline: string | null;
  remainingMinutes: number | null;
}
```

Rules:

- `deadline` mirrors the valid normalized ISO deadline, otherwise `null`;
- `remainingMinutes` is a non-negative whole number only for `OPEN_BY_DEADLINE`;
- closed/unknown => `remainingMinutes: null`;
- do not add a dynamic human-readable phrase to the backend contract;
- existing fields remain unchanged.

The current `bidDeadline` field remains for backward compatibility.

## Deterministic time source

Implement deadline evaluation as a pure function receiving an explicit `now` value.

Production code may pass the current server time at the service boundary.

Tests must pass a fixed instant.

Do not read `Date.now()` deep inside the pure evaluator.

Stable rules:

- `deadline > now` => OPEN_BY_DEADLINE;
- `deadline <= now` => CLOSED_BY_DEADLINE;
- missing/unparsable => DEADLINE_UNKNOWN;
- remaining minutes use floor or ceil consistently and document the choice.

Prefer a behavior that does not tell the operator there are `0 minutes remaining` while the deadline is still in the future.

## Backend integration

Compute `timing` after source normalization, alongside the existing CP-07 assessment.

Fixture and Goszakup lots must use the same timing evaluator.

Do not duplicate timing logic in source adapters/controllers/frontend.

Preserve:

- source selection;
- CP-06 filter pushdown;
- CP-07 MATCH/REVIEW/EXCLUDE rules;
- CP-08 metadata mapping;
- error handling;
- 404/503 behavior.

## Deadline filter

Extend the existing public GET list filter with one optional value:

`deadlineStatus=OPEN_BY_DEADLINE|CLOSED_BY_DEADLINE|DEADLINE_UNKNOWN`

Rules:

- validated by backend;
- applied locally after timing derivation;
- never pushed to Goszakup;
- unknown value => 400;
- existing filters remain compatible.

Frontend should offer:

- all deadlines;
- open by deadline;
- deadline unknown;
- closed by deadline.

Keep URL shareable.

## Optional convenience preset

The existing `Наш профиль` preset may additionally include:

`deadlineStatus=OPEN_BY_DEADLINE`

only if this does not make the URL/filter behavior confusing.

If included, make the active filter visible in the form.

Do not silently hide expired tenders by default.

## Frontend list

Each list card should show a compact time state.

Examples:

- `Срок открыт · 2 дн. 4 ч.`
- `Срок истёк`
- `Срок не указан`

The exact copy may vary, but must not say:

- `Тендер открыт`
- `Приём заявок открыт`

unless that fact comes from an explicit official status contract rather than deadline arithmetic.

For future deadlines, use concise Almaty-oriented human display.

Do not add a live countdown timer or client-side interval.

Server-rendered value is sufficient for CP-09.

## Frontend detail

In `Данные закупки` or immediately near the deadline, show:

- deadline state;
- remaining duration for future deadlines;
- existing official status separately.

Keep the distinction visible:

**official status** and **deadline-derived state** are different facts.

## Interaction with triage

Do not change CP-07 MATCH/REVIEW/EXCLUDE semantics in this checkpoint.

A past deadline does not automatically mutate assessment to EXCLUDE.

Deadline timing is a separate operational dimension.

This avoids silently changing an already approved business rule.

## Fixture coverage

Ensure deterministic fixtures cover:

- future valid deadline;
- past valid deadline;
- missing deadline;
- invalid deadline if such a normalized state can still exist in fixture/domain tests.

Do not make fixtures use the real current date in tests.

Use fixed clocks.

## Deterministic tests

All CI tests remain offline and tokenless.

Cover at minimum:

- future deadline => OPEN_BY_DEADLINE;
- exactly-now deadline => CLOSED_BY_DEADLINE;
- past deadline => CLOSED_BY_DEADLINE;
- missing deadline => DEADLINE_UNKNOWN;
- invalid deadline => DEADLINE_UNKNOWN;
- remainingMinutes behavior at boundaries;
- evaluator uses injected/fixed now;
- list API includes timing;
- detail API includes timing;
- deadlineStatus filter;
- invalid deadlineStatus => 400;
- fixture regression;
- mocked live Goszakup regression;
- CP-07 assessment unchanged;
- CP-08 procurement metadata unchanged;
- deadline filter is not pushed upstream;
- frontend list renders all three timing states;
- frontend detail distinguishes official status vs deadline state;
- existing query parameters survive deadline filter changes;
- source-status and health regressions.

## Documentation

Update README or existing API documentation:

- describe the additive `timing` contract;
- explicitly say it is derived from deadline only;
- state that `OPEN_BY_DEADLINE` is **not** an official procurement status;
- source record remains authoritative.

Do not create a new documentation subsystem.

## Out of scope

Do **not** add:

- cron/scheduler;
- recurring refresh;
- notifications;
- Telegram/WhatsApp/email;
- browser timers/live countdown;
- persistence/database;
- historical ingestion;
- automatic archive;
- ranking/scoring changes;
- AI/LLM/RAG;
- OCR/document parsing;
- new Goszakup queries;
- Samruk integration;
- authentication;
- new infrastructure;
- deployment changes.

## Acceptance criteria

1. Every public lot response has additive `timing`.
2. Timing uses one pure deterministic evaluator.
3. Fixture and live lots use the same timing logic.
4. Future/past/unknown deadline states are correct.
5. Remaining time is exposed only for future deadlines.
6. Official status and derived timing remain separate.
7. Public deadlineStatus filter works.
8. deadlineStatus is local-only and never pushed upstream.
9. Existing filters remain green.
10. CP-07 assessment behavior remains unchanged.
11. CP-08 procurement metadata remains unchanged.
12. List UI shows deadline-derived state.
13. Detail UI clearly distinguishes official status from deadline-derived state.
14. No default hiding of expired tenders.
15. No scheduler/notification infrastructure is introduced.
16. `pnpm format:check` passes.
17. `pnpm lint` passes.
18. `pnpm typecheck` passes.
19. `pnpm test` passes.
20. `pnpm test:e2e` passes.
21. `pnpm build` passes.
22. GitHub CI is green.

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

- background scheduling;
- notifications;
- persistence/schema migration;
- breaking public API changes;
- a new service/repository;
- new infrastructure;
- unapproved recurring cost.

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
Timing rules: PASS | PARTIAL | BLOCKED
Changed: ...
Remaining: ...
```

If complete, do not invent or begin the next checkpoint.
