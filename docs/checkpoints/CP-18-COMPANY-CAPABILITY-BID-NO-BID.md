# CP-18 — Company capability and bid/no-bid matrix

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Answer the business question: “Can we realistically execute this tender?”

## Required outcome
Introduce one explicit company capability profile and compare it with extracted/source facts across dimensions such as:
- product/furniture type;
- allowed/excluded materials;
- amount limits;
- geography/delivery;
- dimensions/quantities where safely extractable;
- production/qualification constraints that are explicitly configured.

Output dimension-level PASS / REVIEW / FAIL plus evidence/reason.

## Constraints
Do not replace official eligibility rules. Do not use opaque scoring. Do not duplicate CP-07; CP-18 is deeper post-document capability fit.

## Acceptance
Every FAIL/REVIEW can be explained by configured company capability or missing source evidence; no unsupported requirement becomes PASS.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
