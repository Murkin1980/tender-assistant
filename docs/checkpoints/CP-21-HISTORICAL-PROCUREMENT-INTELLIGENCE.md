# CP-21 — Historical procurement intelligence

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Fulfil the original analytical value proposition using past procurement outcomes.

## Required outcome
- bounded historical ingestion strategy;
- durable normalized records for relevant lots/announcements/contracts/results;
- resumable/idempotent import;
- customer/supplier/winner context;
- planned vs awarded price;
- repeat procurement patterns;
- historical search/filter views;
- freshness/provenance.

## Constraints
Start with the smallest business-relevant historical slice; do not ingest the entire national corpus without measured need.

## Acceptance
For a current tender/category/customer, the operator can inspect source-backed historical context and reproduce how each analytical figure was derived.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
