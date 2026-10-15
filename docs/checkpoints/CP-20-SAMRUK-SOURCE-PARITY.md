# CP-20 — Samruk procurement source parity

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Add Samruk procurement as the second real source without creating a parallel product.

## Required outcome
- verify current official/open source interfaces;
- map Samruk lots into the existing canonical lot contract;
- bounded list/detail path;
- document metadata/links where officially available;
- explicit source capabilities/limitations;
- fixture/live parity and tokenless CI.

## Constraints
Reuse the existing source boundary. No silent HTML scraping if a stable official path cannot be verified.

Do not force Goszakup-only fields into fabricated Samruk values; unavailable facts stay explicit.

## Acceptance
The same operator list/detail workflow can represent Goszakup and Samruk lots while preserving source identity and limitations.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
