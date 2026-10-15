# CP-18 — Company capability and bid/no-bid matrix

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Reuse saved company profile, CP-16 source-linked requirements report and CP-17 readiness data.

## Objective

Answer two connected questions:

1. **Подходит ли этот тендер нашей компании?**
2. **Почему система рекомендует или не рекомендует брать его в работу?**

This is the deep post-document matching layer used both in tender detail and, where enough evidence is available, to improve scheduled tender recommendations.

## Required outcome

Compare explicit company capability/configuration with source-linked tender requirements across dimensions such as:

- product/furniture type;
- allowed/excluded materials;
- manufacturing/technical capabilities;
- dimensions/quantities/capacity where configured;
- amount/economic thresholds;
- geography/delivery;
- installation/service ability;
- delivery deadline feasibility when deterministically known;
- qualification/certificate requirements known to the company profile.

Output dimension-level:

- PASS;
- REVIEW;
- FAIL;

with evidence/reason and source links.

Provide an overall operator recommendation only as a transparent composition of those dimensions, never as opaque scoring.

## Scheduled-selection interaction

CP-15 may initially recommend tenders using earlier profile/actionability rules.

After CP-18 exists, scheduled discovery may enrich the recommendation using the deeper capability result when document evidence can be processed within the bounded run.

Do not create two unrelated recommendation identities or ranking systems.

## Constraints

Do not replace official eligibility rules.
Do not claim legal compliance.
Do not use opaque AI scoring.
Do not silently turn missing evidence into PASS.

## Acceptance

Every recommendation is explainable from:

- configured company capability;
- source-backed tender requirement;
- explicit missing/unknown evidence.

A user can open a periodically discovered tender and understand why it was selected.

## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, CP-15 through CP-17 as applicable, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
