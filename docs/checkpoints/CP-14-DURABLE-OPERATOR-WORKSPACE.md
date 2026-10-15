# CP-14 — Durable operator workspace

Status: PLANNED — DO NOT IMPLEMENT WITHOUT EXPLICIT OWNER START

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`. Do not create a parallel product or repository.


## Objective
Replace stateless browsing with a durable private workspace without turning the project into a multi-user SaaS.

## Required outcome
- canonical saved-tender identity based on source + external identity;
- minimum persistent storage;
- save/unsave;
- operator workflow state;
- notes;
- created/updated timestamps;
- list of saved tenders;
- safe migration and backup baseline;
- source facts remain distinct from operator-entered state.

## Constraints
One tender has one canonical identity and multiple representations. Do not duplicate live lots into parallel identities.

Single-user/private use first. No organizations, billing, roles, or collaboration.

## Acceptance
Saved tenders and notes survive restarts/deployments; duplicate saves converge on the same identity; live source data and operator state remain clearly separated.


## Process rule

Before implementation, re-read `docs/roadmap/PRODUCT-READINESS-ROADMAP-2026-10-15.md`, all direct prerequisite checkpoints, `AGENTS.md`, and `docs/governance/SCOPE-CHANGE-CONTROL.md`.

Promote this checkpoint to APPROVED FOR IMPLEMENTATION only after explicit owner instruction.

Use one bounded Arena branch and one PR. Do not begin the next checkpoint. Do not merge without owner authority.
