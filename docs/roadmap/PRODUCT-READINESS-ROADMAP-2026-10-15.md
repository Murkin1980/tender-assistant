# Tender Assistant — Product Readiness Audit and Roadmap

Date: 2026-10-15
Baseline: main after CP-12
Decision: EXTEND_EXISTING

## Product definition

Tender Assistant 1.0 is not merely a tender registry viewer and not an OCR tool.

The primary product loop is:

**configure company/tender profile -> run manually or on a user-defined schedule -> discover and rank suitable tenders -> inspect official technical/procurement documents -> understand and structure requirements -> produce a source-linked tender report -> explain why the tender fits or needs review -> save it into a work queue -> monitor changes/deadlines -> prepare participation.**

OCR is only an auxiliary input method for scanned/image-only documents. It is not a standalone product milestone.

## Executive conclusion

The repository has passed the prototype stage and is now a strong **functional operator MVP**, but it is not yet a production-ready autonomous tender workflow.

What already works end-to-end:

- bounded live Goszakup OWS v3 source;
- list/detail flow;
- deterministic profile triage;
- deadline state;
- TAKE / REVIEW / SKIP operator actionability;
- official procurement metadata;
- official document metadata/links;
- bounded document byte retrieval;
- deterministic requirements extraction from verified text-native PDF and DOCX;
- source locators and manual-review warnings;
- offline/tokenless regression suite;
- Docker smoke test in CI.

Main product gaps relative to the intended product loop:

- no production deployment or release environment;
- no durable operator workspace / database;
- no saved tender profiles and user-defined search schedules;
- no automatic recurring market scan to discover new matching tenders;
- no ranking/report of newly found tender proposals per run;
- no monitoring of changes after a tender is saved;
- no actionable alerts/reminders;
- document understanding is still a baseline extractor rather than a complete technical-document interpretation/report layer;
- scanned/image-only documents remain manual; OCR is only a fallback gap;
- no participation-readiness checklist;
- no company capability matrix against extracted technical/commercial requirements;
- no bid workspace/package preparation;
- no Samruk source;
- no historical procurement intelligence;
- no source-cited AI/RAG layer for semantic questions and difficult document interpretation;
- no final production security/backup/observability/release acceptance gate.

## Product readiness estimate

These are product estimates, not automated test metrics.

- Core technical quality: **~80%**
- Manual current-tender discovery/triage/detail workflow: **~65%**
- Technical-document understanding/report quality: **~40%**
- Automated recurring tender-selection workflow: **~20%**
- Daily operator workflow readiness: **~40%**
- Production/operational readiness: **~30%**
- Full intended Product 1.0 readiness: **~35%**

The project is therefore best described as:

**Stage: FUNCTIONAL MVP / PRE-PRODUCTION**

It can already evaluate live tenders in a controlled manual flow. It cannot yet act as the user's recurring tender-selection and document-understanding workspace.

## Process change after CP-12

From CP-13 onward, checkpoints are organized by **complete operator outcomes**, not by isolated APIs.

Every checkpoint must answer:

1. What operator problem becomes usable after this checkpoint?
2. What source/persistent contract is the minimum required?
3. What production risk/cost is introduced?
4. What real or realistic evidence proves the outcome?
5. What remains explicitly out of scope?
6. Does this move the main product loop forward: scheduled discovery -> understanding -> report -> decision -> participation?

All CP-13+ checkpoints are initially **PLANNED**. Only the current next checkpoint may be promoted to APPROVED FOR IMPLEMENTATION by explicit owner instruction.

Do not begin later checkpoints opportunistically.

## Milestones

### Milestone A — Operational 1.0
Goal: one private operator can configure a search profile, run it manually or periodically, receive matching tenders, understand their requirements in a report, decide whether to participate, and manage active opportunities.

Requires CP-13 through CP-19.

### Milestone B — Full Product 1.0
Goal: satisfy the broader product vision with a second source, historical intelligence, source-cited AI assistance for difficult semantic/document questions, and production release acceptance.

Requires CP-20 through CP-23.

## Remaining checkpoints

### CP-13 — Production runtime and live release path
Deploy the current product safely with real Goszakup configuration, secrets, health checks, private access, rollback, and real live smoke evidence.

### CP-14 — Durable operator workspace and search profiles
Introduce minimum persistence for saved tenders plus saved company/search profiles, operator state, notes, timestamps, and canonical lot identity.

### CP-15 — Scheduled tender discovery, matching, monitoring and alerts
Allow the operator to run a saved search manually or configure a cadence (for example daily, every N days, weekly, or selected calendar days). Each run searches the live source, applies profile/actionability rules, produces a deduplicated set of newly matching tender proposals with reasons, records run history, and then monitors saved opportunities for deadline/status/document changes.

### CP-16 — Technical-document understanding and source-linked requirements report
Deepen CP-12 from baseline extraction into a complete tender-document interpretation layer: combine requirements across technical specifications and related procurement documents, preserve tables/sections/source locators, identify mandatory vs informational clauses, technical parameters, quantities, materials, dimensions, delivery/commercial/qualification obligations, contradictions and missing references, and produce one structured report. OCR is used only as a bounded fallback for scanned/image-only pages when needed.

### CP-17 — Participation readiness checklist
Transform the CP-16 requirements report into a practical checklist of what the bidder must provide/do: qualification evidence, guarantees, certificates, forms, technical confirmations, delivery/commercial obligations, and manual-review gaps.

### CP-18 — Company capability / bid-no-bid matrix
Compare the source-linked requirements report with the explicit company capability profile and return explainable PASS / REVIEW / FAIL dimensions. This is the deep matching step that tells the operator why a tender is a good candidate or risky.

### CP-19 — Bid workspace and application package preparation
For a selected tender, maintain participation workflow, required artifacts, completion state, source links, due dates and operator-ready draft/checklist exports. No autonomous submission.

### CP-20 — Samruk procurement source parity
Add Samruk as a second normalized source behind the existing source boundary, including scheduled-discovery parity where the source permits it.

### CP-21 — Historical procurement intelligence
Add controlled historical ingestion/storage and analytical views for past lots/contracts/results: customers, suppliers, winning amounts, price history and repeat procurement patterns.

### CP-22 — Source-cited AI / RAG semantic assistant
Use AI only over established source-linked documents/data for difficult semantic interpretation and questions that deterministic rules cannot reliably solve. Answers must cite their source evidence, remain bounded, and fail safely.

### CP-23 — Production hardening and Product 1.0 acceptance
Security review, backups/recovery, observability, data-retention rules, performance limits, real-production E2E acceptance, operator runbook, rollback and version 1.0 release decision.

## Dependency chain

CP-13 -> CP-14 -> CP-15

CP-11/12 -> CP-16 -> CP-17 -> CP-18 -> CP-19

CP-14/15 -> CP-20 -> CP-21

CP-16/17/21 -> CP-22

CP-13..22 -> CP-23

The default execution order remains sequential unless a checkpoint is demonstrably independent and parallel work would not duplicate source-of-truth logic.

## Explicit non-goals before CP-23

- autonomous tender submission;
- legal guarantee of eligibility;
- autonomous pricing/bidding;
- multi-tenant SaaS;
- generic procurement platform for third parties;
- unbounded crawling;
- AI decisions without source evidence.

## Definition of Product 1.0

Tender Assistant 1.0 is ready when a private operator can:

1. open the production system;
2. create/edit a company and tender-search profile;
3. run tender search manually;
4. configure recurring search cadence/calendar;
5. receive a deduplicated report of newly matched tender proposals with reasons;
6. open a tender and inspect official source metadata/documents;
7. receive a structured source-linked technical/requirements report;
8. process common scanned documents through OCR only when necessary;
9. save an opportunity into a durable workspace;
10. track changes/deadlines and receive actionable alerts;
11. see participation-readiness gaps;
12. see company capability fit with explanations;
13. prepare and track the bid package;
14. inspect historical market context;
15. ask a source-cited semantic assistant difficult questions;
16. recover safely from service/data failures;
17. complete a real production smoke path without developer intervention.
