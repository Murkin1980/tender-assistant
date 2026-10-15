# CP-16 — Technical-document understanding and source-linked requirements report

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Extend CP-11/12 rather than creating a parallel document-analysis system.

## Objective

The goal is **not OCR**.

The goal is to correctly understand the tender's technical and procurement documentation and produce one operator-ready, source-linked report of what the tender actually requires.

OCR is only an input fallback when a relevant page/document has no usable text layer.

## Required outcome

Build on CP-12 to understand requirements across all supported documents for one tender.

The report must identify, where present:

- procurement subject / what must be supplied;
- quantities;
- dimensions and tolerances;
- materials, finishes, brands/standards/equivalency clauses;
- construction/technical characteristics;
- drawings/schemes/tables and references to them;
- delivery place and deadline;
- installation/assembly/service obligations;
- warranty;
- acceptance/testing requirements;
- qualification requirements;
- certificates/declarations/supporting documents;
- bid/security guarantees;
- payment/commercial conditions;
- mandatory official forms/attachments;
- contradictions between documents;
- referenced but missing attachments;
- facts that remain ambiguous and require manual review.

Every substantive extracted statement must preserve source document identity and the most precise reliable locator available.

## Multi-document interpretation

Requirements may be distributed across several documents. CP-16 must:

- combine them into one report without losing provenance;
- avoid duplicate clauses where the same requirement is repeated;
- preserve conflicting clauses instead of silently choosing one;
- distinguish mandatory requirements from descriptive/informational text when the source language supports that distinction;
- keep unknown/ambiguous semantics explicit.

## Tables and structured content

Document understanding must preserve meaningful table relationships (row/column/header context) rather than flattening every cell into unrelated text where practical.

If dimensions/quantities/materials are in tables, the report must retain enough context to understand what object/item the values belong to.

## OCR fallback

Only when a source document/page is materially relevant and lacks a usable text layer:

- apply a bounded OCR path;
- preserve document/page evidence;
- mark OCR-derived text as OCR-derived;
- retain a low-quality/manual-review state when confidence/legibility is insufficient;
- enforce file/page/time/cost limits.

OCR must never be treated as a separate product outcome.

## Semantic interpretation boundary

Prefer deterministic parsing/rules where reliable.

If real evaluation proves that mandatory-vs-informational distinction, cross-document semantics or complex clauses cannot be handled adequately without a language model, record a measured gap for CP-22 rather than silently adding unapproved AI here.

## Report output

The operator should receive one structured report with at least:

- summary;
- technical requirements;
- quantities/dimensions/materials;
- delivery/service/warranty;
- qualification/supporting documents;
- commercial/guarantee obligations;
- contradictions/missing references;
- manual-review warnings;
- source evidence for every item.

Exact API shape may be finalized at implementation start based on CP-12 evidence.

## Acceptance

Use a fixed real-world evaluation set representing multiple procurement documents per tender.

PASS requires demonstrating that an operator can answer “what exactly is required from us?” from the generated report without manually re-reading every supported source document, while every material claim remains traceable to source evidence.

Coverage/quality metrics and known misses must be reported.

## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, CP-11, CP-12, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
