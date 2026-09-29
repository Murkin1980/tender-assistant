# CP-12 — Deterministic requirements extraction

Status: PLANNED — DO NOT IMPLEMENT UNTIL CP-11 IS MERGED AND OWNER EXPLICITLY STARTS CP-12

## New Idea Filter

Decision: **EXTEND_EXISTING**

Continue `Murkin1980/tender-assistant`.

Reuse CP-11 official document identity/links and the existing lot detail decision flow.

Do not create a new repository or parallel document-analysis system.

## Objective

After official procurement documents are available from CP-11, extract a small, reviewable requirements view that helps the operator answer:

- What must be supplied?
- What quantities/dimensions/material requirements are stated?
- What delivery/location/timing requirements are stated?
- What qualification or supporting-document requirements are stated?
- Which facts could not be extracted safely and still require manual review?

The first implementation must be deterministic and evidence-linked.

## Authorization boundary

This checkpoint document defines the intended next stage but is **not implementation authority yet**.

Implementation may begin only after:

1. CP-11 is merged;
2. the actual document formats/source behavior are known;
3. the owner explicitly starts CP-12.

At that moment, re-run the New Idea Filter against the real CP-11 evidence.

## Default implementation strategy

Prefer the smallest deterministic path:

1. Use already accessible official document bytes only when a bounded, safe fetch is possible.
2. Start with text-native formats that can be parsed reliably with the existing stack or one justified parser dependency.
3. Extract plain text.
4. Derive a small requirements structure with deterministic rules/heading matching.
5. Keep source evidence: document ID/name and page/section/sheet position when available.
6. Mark unknowns explicitly.

Do not start with embeddings, RAG or an LLM.

## Proposed contract

The exact public contract must be finalized against CP-11 evidence before implementation.

Target shape:

```ts
requirements: {
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  items: Array<{
    category:
      | 'SUBJECT'
      | 'QUANTITY'
      | 'DIMENSIONS'
      | 'MATERIAL'
      | 'DELIVERY'
      | 'QUALIFICATION'
      | 'SUPPORTING_DOCUMENT'
      | 'OTHER';
    text: string;
    sourceDocumentId: string;
    sourceLocator: string | null;
  }>;
  warnings: string[];
}
```

Rules:

- never invent a requirement;
- every extracted item must point back to a source document;
- source locator is required when the parser can reliably provide one;
- uncertain extraction belongs in warnings/manual review, not as a confident requirement;
- no score/confidence percentage unless a later approved checkpoint defines calibrated semantics.

## Format scope

The implementation checkpoint must explicitly name supported formats based on CP-11 evidence.

Preferred first scope:

- text-native PDF;
- DOCX;
- XLSX only if actually observed and needed.

Legacy binary DOC/XLS, scanned PDFs, archives and unusual formats should remain unsupported unless separately justified.

## OCR deep-change gate

OCR is not automatically authorized.

If material CP-11 documents are scanned/image-only and OCR becomes necessary:

- stop that portion;
- report observed frequency/importance;
- propose the smallest OCR experiment;
- obtain explicit owner approval before adding OCR runtime/service/dependency/cost.

## AI / LLM / RAG deep-change gate

LLM/RAG extraction is not automatically authorized.

If deterministic parsing cannot provide sufficient business value:

- preserve the deterministic baseline;
- measure concrete misses;
- propose a bounded AI experiment against a fixed evaluation set;
- obtain explicit owner approval before adding model APIs, embeddings, vector storage or recurring cost.

## Storage boundary

Default: no database or long-term document storage.

If parsing requires temporary local bytes, keep them bounded to the request/test lifecycle and remove them after use.

Persistence, Cloud Storage, historical ingestion and corpus indexing remain separate deep-change scope.

## UI target

On `/lots/[id]`, place a `Требования` section below/near CP-11 documents.

Show:

- extracted requirement items grouped by category;
- source document for each item;
- source locator when known;
- warnings / `нужно проверить вручную`;
- unsupported-document state.

The UI must distinguish extracted source facts from operator recommendation/actionability.

## Tests

When implementation is authorized, tests must use deterministic local fixtures and remain offline/tokenless.

Cover:

- supported text-native format extraction;
- unsupported format state;
- empty document;
- malformed document;
- requirement item preserves source identity;
- no requirement is produced without source text evidence;
- repeated headings/sections behave deterministically;
- partial extraction produces `PARTIAL` + warnings;
- no OCR/model/network call in baseline tests;
- CP-11 document metadata regression;
- CP-08/09/10 regressions;
- frontend AVAILABLE/PARTIAL/UNAVAILABLE states.

## Out of scope for baseline CP-12

Unless explicitly re-authorized at implementation start, do **not** add:

- OCR;
- LLM;
- embeddings;
- RAG/vector database;
- historical corpus;
- bulk ingestion;
- persistent database;
- object storage;
- autonomous tender submission;
- legal eligibility conclusions;
- ranking/scoring;
- Samruk;
- new repository/service.

## Completion target

A successful baseline CP-12 should prove that at least one real, common text-native procurement-document format can be transformed into a reviewable, source-linked requirement list without AI.

If that cannot be proven, return `PARTIAL` or `BLOCKED` with evidence rather than broadening scope.

## Branch / PR

When explicitly authorized later:

- start from then-current `main`;
- use one Arena branch;
- one PR into `main`;
- do not merge automatically;
- stop after green CI.

Do not begin implementation from this planning checkpoint alone.
