# Tender Assistant — Product Readiness Audit and Roadmap

Date: 2026-10-15
Baseline: main after CP-12
Decision: EXTEND_EXISTING

## Executive conclusion

The repository has passed the prototype stage and is now a strong **functional operator MVP**, but it is not yet a production-ready daily-work product.

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
- offline/tokenless regression suite;
- Docker smoke test in CI.

Main product gaps:

- no production deployment or release environment;
- no durable operator workspace / database;
- no saved tenders, decisions, notes, or history;
- no monitoring of changes after a tender is saved;
- no alerts/reminders;
- scanned/image-only documents remain manual;
- no participation-package readiness workflow;
- no company capability matrix against extracted requirements;
- no bid workspace/package preparation;
- no Samruk source;
- no historical procurement intelligence;
- no source-cited AI/RAG assistant;
- no final production security/backup/observability/release acceptance gate.

## Product readiness estimate

These are product estimates, not automated test metrics.

- Core technical quality: **~80%**
- Current-tender discovery/triage/document-analysis workflow: **~65%**
- Daily operator workflow readiness: **~45%**
- Production/operational readiness: **~30%**
- Full original product vision readiness: **~35%**

The project is therefore best described as:

**Stage: FUNCTIONAL MVP / PRE-PRODUCTION**

It is already useful for controlled evaluation, but not yet the system to rely on as the single daily tender workspace.

## Process change after CP-12

From CP-13 onward, checkpoints are organized by product outcome rather than by individual API/UI capabilities.

Every checkpoint must answer:

1. What operator problem becomes fully usable after this checkpoint?
2. What is the smallest persistent/source contract required?
3. What production risk is introduced?
4. What evidence proves the behavior with real or realistic data?
5. What remains explicitly out of scope?

All CP-13+ checkpoints are initially **PLANNED**. Only the current next checkpoint may be promoted to APPROVED FOR IMPLEMENTATION by explicit owner instruction.

Do not begin later checkpoints opportunistically.

## Milestones

### Milestone A — Operational 1.0
Goal: one private operator can use Tender Assistant every day for live procurement work.

Requires CP-13 through CP-19.

### Milestone B — Full Product 1.0
Goal: satisfy the broader original product vision: second source, history/intelligence, cited AI assistance, and production release acceptance.

Requires CP-20 through CP-23.

## Remaining checkpoints

### CP-13 — Production runtime and live release path
Deploy the current product safely with real Goszakup configuration, secrets, health checks, private access, rollback, and real live smoke evidence.

### CP-14 — Durable operator workspace
Introduce the minimum persistence model for saved tenders, operator state, notes, timestamps, and canonical lot identity. Single-user first; no enterprise tenancy.

### CP-15 — Tender monitoring and alerts
Refresh saved tenders on a bounded schedule, detect deadline/status/document changes, maintain a small change history, and notify only on actionable changes.

### CP-16 — Document coverage and OCR
Extend document handling to scanned/image-only PDFs and justified additional common formats using a bounded OCR/document pipeline with measurable quality.

### CP-17 — Participation readiness checklist
Convert source-linked requirements into a deterministic checklist: qualification evidence, guarantees, certificates, required attachments, delivery/commercial obligations, and manual-review gaps.

### CP-18 — Company capability / bid-no-bid matrix
Compare extracted tender requirements with an explicit company capability profile (materials, product types, production constraints, geography, amount/delivery rules) and return explainable PASS / REVIEW / FAIL dimensions.

### CP-19 — Bid workspace and application package preparation
For a selected tender, maintain the participation workflow, required artifacts, completion state, source links, and generate/export operator-ready draft documents/checklists. No autonomous submission.

### CP-20 — Samruk procurement source parity
Add Samruk as a second normalized source behind the existing source boundary, with bounded search/detail/document paths and explicit parity/limitations.

### CP-21 — Historical procurement intelligence
Add controlled historical ingestion/storage and analytical views for past lots/contracts/results: customers, suppliers, winning amounts, price history and repeat procurement patterns.

### CP-22 — Source-cited AI / RAG assistant
Add AI only over established source-linked data/documents with retrieval evidence, citations, bounded context, evaluation set, cost controls and deterministic fallback.

### CP-23 — Production hardening and Product 1.0 acceptance
Security review, backups/recovery, observability, data-retention rules, performance limits, real-production E2E acceptance, operator runbook, rollback and version 1.0 release decision.

## Dependency chain

CP-13 -> CP-14 -> CP-15

CP-11/12 -> CP-16 -> CP-17 -> CP-18 -> CP-19

CP-14 -> CP-20 -> CP-21

CP-16/17/21 -> CP-22

CP-13..22 -> CP-23

Some work can theoretically run in parallel, but default execution is sequential to preserve the MPE small-change discipline.

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
2. receive live tenders from supported sources;
3. shortlist them against a company profile;
4. inspect official source metadata/documents;
5. extract/read requirements including common scanned documents;
6. save a tender into a durable workspace;
7. track changes/deadlines;
8. receive actionable alerts;
9. see participation-readiness gaps;
10. see company capability fit with explanations;
11. prepare and track the bid package;
12. inspect historical market context;
13. ask a source-cited assistant questions;
14. recover safely from service/data failures;
15. complete a real production smoke path without developer intervention.
