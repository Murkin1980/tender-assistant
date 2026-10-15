# CP-15 — Scheduled tender discovery, matching, monitoring and alerts

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse saved search/company profiles from CP-14 and the existing live-source, filtering, assessment, timing and actionability pipeline.

## Objective

Stop requiring the operator to remember to search the market manually.

The operator must be able to:

- run a saved tender search immediately;
- configure how often it runs;
- receive a deduplicated set of newly found matching tender proposals with reasons;
- save interesting opportunities;
- monitor saved opportunities for meaningful changes.

## Required outcome

### Search scheduling
Support a simple user-configurable schedule without exposing raw cron syntax as the primary UI:

- manual only;
- daily;
- every N days (including every 2 or 3 days);
- weekly;
- selected days of week / simple calendar selection when practical.

Persist the schedule, timezone and next/last run state.

### Scheduled discovery
For each due profile:

- run a bounded live-source search using the approved source/query boundary;
- apply the same canonical normalization and matching/actionability rules used by the manual UI;
- deduplicate against previous runs by canonical source identity;
- produce a run report containing newly matched tenders, previously seen tenders, rejected/review candidates and reason/evidence;
- never create duplicate tender identities.

### Monitoring
For saved/active opportunities:

- refresh bounded source facts;
- detect meaningful deadline/status/document changes;
- keep compact change history;
- maintain last successful check and error state.

### Alerts
Notify only on actionable events such as:

- new high-relevance/matching tender found;
- important deadline/status/document change;
- configured deadline reminder.

Alerts must be deduplicated and link back to the tender/run report.

## Constraints

- no unbounded national crawler;
- no duplicate matching engine separate from CP-07/10/18;
- no noisy alert on unchanged scans;
- schedules must be bounded and rate-safe;
- notification channel must reuse an approved integration where possible;
- recurring cost requires approval.

## Acceptance

A fixed test scenario proves:

1. manual run works;
2. configurable every-N-days/weekly schedule computes the correct next run;
3. first run finds a new matching tender;
4. second unchanged run does not re-alert it as new;
5. a later source change produces one deduplicated change alert;
6. failures do not create false changes or advance success timestamps;
7. all results retain canonical source identity and matching reasons.

## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, CP-14 and the relevant source/matching checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
