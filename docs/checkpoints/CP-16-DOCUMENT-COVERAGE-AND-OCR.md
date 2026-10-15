# CP-16 — Document coverage and OCR

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Reduce the largest CP-12 manual-review gap: scanned/image-only and other common procurement documents.

## Required outcome
- evidence-based format inventory from real saved/live tenders;
- OCR only for formats that materially block the workflow;
- page/source locators preserved;
- deterministic pre/post-processing;
- quality benchmark set;
- explicit unreadable/low-quality state;
- bounded file size/pages/time/cost.

## Constraints
Do not treat OCR output as authoritative without source evidence. Do not add a generic document platform.

Additional DOC/XLS/XLSX/archive support is allowed only when real frequency justifies it.

## Acceptance
A fixed real-world evaluation set demonstrates measurable extraction coverage improvement while preserving source/page evidence and safe manual-review fallback.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
