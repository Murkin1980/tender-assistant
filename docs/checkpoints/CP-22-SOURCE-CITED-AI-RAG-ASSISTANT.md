# CP-22 — Source-cited AI and RAG assistant

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Add AI only where deterministic product foundations are already insufficient.

## Required outcome
- fixed evaluation questions and expected evidence;
- retrieval over source-linked procurement text/data;
- every substantive answer cites source document/record;
- refusal/unknown behavior when evidence is absent;
- bounded context and cost;
- prompt-injection/document-content defenses;
- deterministic fallback views remain available;
- model/provider abstraction only if justified by an actual second provider requirement.

## Constraints
AI must not become the source of truth and must not silently override CP-07/10/17/18 deterministic states.

## Acceptance
Evaluation demonstrates useful answers with traceable citations and acceptable hallucination/error rate; unsupported questions fail safely.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
