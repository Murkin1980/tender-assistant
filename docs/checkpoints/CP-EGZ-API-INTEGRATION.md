# CP-EGZ — official OWS read-only integration acceptance

Date: 2026-11-04. Decision: **EXTEND_EXISTING**. Overall: **PARTIAL**.
Merge, deploy and production-secret modification are NOT authorized.

## CP-EGZ-00 — PASS: preflight and scope

Read AGENTS.md, Scope & Change Control, README and CP-04/CP-13.
No mandatory repository rule requires a separate Codex executor; the owner explicitly
allowed direct Arena execution. No new client, service or public API is introduced.

At preflight `origin/main` and this session's base were both
`0e4447a8ca5b34c70f72ab1e0406449872affb5b`.
[PR #13](https://github.com/Murkin1980/tender-assistant/pull/13) was OPEN,
MERGEABLE/CLEAN, head `dcc19786e0834e4100a74f3f9bdf336222c1eb56`.
Its Quality gates and Docker smoke checks passed; these are historical PR evidence,
not evidence of current live access.

Owner-authorized selective reuse, NOT a merge: copy only these four backend files
from that head (none existed on main, so no overlapping edits):

- `backend/src/worker.ts`
- `backend/src/worker-empty.ts`
- `backend/worker-entry.mjs`
- `backend/wrangler.jsonc`

Wrangler 4.151.0 is pinned as a development dependency to bundle/test that existing
runtime path. Its esbuild/workerd installation scripts are explicitly allowed.
No OpenNext/frontend runtime, deploy scripts, Docker secret-file mechanism, routes,
Access policies or production settings were transferred. Existing Node/Docker
frontend/backend behavior stays intact. A full Cloudflare frontend release remains
PR #13 scope; merging both PRs later requires normal conflict/integration review.

## CP-EGZ-01 — PARTIAL: API contract

Reuse the contract already recorded in CP-04 and the existing boundary:

- Official documentation reference: https://ows.goszakup.gov.kz/help/v3/schema/
- Endpoint: `POST https://ows.goszakup.gov.kz/v3/graphql`.
- Authentication: backend-only `Authorization: Bearer` from `GOSZAKUP_TOKEN`.
- `GOSZAKUP_LOTS_QUERY`: `Lots(filter: LotsFiltersInput, limit: Int)`.
- Default public sample: 20; client hard bound: 1..200; probe: 5.
- Detail: one `id` filter with limit 1, not a registry scan.
- `q` maps to `nameDescriptionRu`. Other predicates remain local, applied to the
  bounded sample; this is not exhaustive national search or pagination.
- Mapper preserves the existing Lot contract; missing fields are not fabricated.
- Missing token, HTTP/GraphQL/protocol errors and timeout fail explicitly, without
  silently substituting fixture data. No retry, mutation, submission or signature.
- Authenticated GraphQL fetch now rejects redirects instead of following them.

These are repository contract statements, NOT a fresh upstream validation.
Current OWS V2/V3 documentation cannot be retrieved from this environment's
permitted hosts. V2 compatibility, schema currency and deprecation status are
UNVERIFIED. No speculative V2 client or fallback is added.

## CP-EGZ-02 — PARTIAL: Cloudflare secret boundary

The reused Worker uses `nodejs_compat`, compatibility date 2026-10-15 and the
existing backend `process.env.GOSZAKUP_TOKEN` configuration. The intended binding
is a Worker Secret named `GOSZAKUP_TOKEN`, never a Wrangler `vars` entry, build
argument, frontend value or committed `.dev.vars` file. `.dev.vars*` and Wrangler
local state are now ignored. The Worker has no public route and workers.dev and
preview URLs are disabled in configuration.

No Cloudflare account/secret store was inspected or modified. Successful secret
binding in a real Cloudflare environment is NOT claimed. A production secret
operation needs separate owner permission and must use a protected secret input,
not a chat message, PR, command argument or log. Do not run a deployment as part
of this checkpoint. Deployment/private Access readiness is not implied by bundling.

## CP-EGZ-03 — BLOCKED: actual registry data

Live probe: **NOT RUN**. This sandbox's network policy does not permit OWS.
No real token was requested, read from Gmail, printed, copied or persisted.
No synthetic response is presented as real procurement evidence.

In an authorized environment only, with a securely injected environment secret,
use the existing `pnpm --filter @tender-assistant/backend probe:goszakup`.
It performs one bounded read. The probe now fails when zero normalized lots are
returned: an empty HTTP-success response is not proof of real mapped data.
Record only non-secret outcome, timestamp, count and a public lot ID/source URL;
verify that public registry object independently. Do not attach headers or raw
request dumps. Production/live verification and log-leak audit remain outstanding.

## CP-EGZ-04 — PARTIAL: existing search integration

Reuse `GoszakupLotSource`, `translateGoszakupLotFilters` and the existing service/UI
path; `TENDER_LOT_SOURCE=goszakup` is server-controlled. Existing e2e tests cover
source selection, errors, bounded list/detail and search. No second UI data model
or browser access to the token/upstream is added. All deterministic checks pass;
real-data user-path acceptance remains blocked with CP-EGZ-03.

## CP-EGZ-05 — PASS locally: tests and negative scenarios

Node 22.22.3; Corepack supplied pnpm 12.4.1 without production changes.
`pnpm install --frozen-lockfile` passed after explicitly allowing the two required
Wrangler build scripts. Local verification:

| Check | Result |
| --- | --- |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS: 168 backend + 40 frontend |
| `pnpm test:e2e` | PASS: 107 backend |
| `pnpm build` | PASS: Nest + Next production bundles |
| Wrangler `deploy --dry-run` | PASS: 3076.57 KiB, no upload/deploy |
| Local workerd `/api/v1/health` | 200, status ok |
| Local workerd `/api/v1/lots`, no token | 503, generic source-unavailable error |

Reproduce bundle validation from repository root after building:

```sh
WRANGLER_SEND_METRICS=false pnpm exec wrangler deploy --config backend/wrangler.jsonc --dry-run --outdir .wrangler/egz-dry-run
```

Local runtime was started with Wrangler `dev --local --ip 0.0.0.0 --port 8787`,
then stopped after the two HTTP assertions. No live upstream request was made:
missing-token validation stopped the list request before fetch. Wrangler warned
that its optional Request.cf metadata download was unavailable and used its
placeholder; this is NOT upstream data or Cloudflare production verification.

Existing tests cover missing token/optional fields, invalid limits, HTTP errors,
GraphQL errors, timeout, malformed JSON and redaction. Added assertions cover
redirect rejection policy (mocked transport failure; not a real redirect-server
integration test) and failure of empty probe evidence. CI now also bundles the
backend Worker with `--dry-run`, never deploys it. CI outcome is recorded in the PR.

## CP-EGZ-06 — PARTIAL: acceptance handoff

Branch: `arena/242ec4c3-tender-assistant`. Commit, PR and CI links are recorded in
the GitHub PR and final handoff to avoid self-referential commit hashes here.
The PR is for review of the bounded implementation, not proof that live MVP
acceptance has passed. Keep unmerged; do not deploy.

Remaining gates: current official V2/V3 contract review, protected Worker Secret
binding validation, bounded real-data probe with public evidence, live search/UI
acceptance, production log audit/private-access and release acceptance when
separately authorized. No production operations are authorized by this document.

## CP-EGZ-LIVE-01 — 2026-11-04 follow-up

Overall **PARTIAL**. Executor: Arena Agent. Same branch and PR #14; no runtime
code changes were needed for the independent verification below.

| Checkpoint | Status | Fresh evidence / exact remaining blocker |
| --- | --- | --- |
| CP-EGZ-01 | PARTIAL | Reviewed existing v3 endpoint, Bearer header, bounded Lots/detail queries, mapper and client error/redirect handling; official current schema inaccessible under sandbox host policy. Repository contract is not fresh official verification. |
| CP-EGZ-02 | PARTIAL | Worker config/bundle and local startup passed; remote Worker existence and Secret-name presence UNVERIFIED: no Cloudflare credentials found and Cloudflare API hosts are not permitted. |
| CP-EGZ-03 | BLOCKED | No environment GOSZAKUP_TOKEN, no local backend .env/.dev.vars files, and OWS hosts are not permitted. No live request or real lot normalization evidence exists. |
| CP-EGZ-04 | PARTIAL | Reviewed text pushdown and local filter implementation; local furniture query fails closed without fixtures. Actual furniture results and filters on real records remain BLOCKED with CP-EGZ-03. |
| CP-EGZ-05 | PASS (independent checks) | Fresh frozen install, format, lint, typecheck, 168 backend + 40 frontend unit, 107 e2e, Nest/Next builds and Worker dry-run all passed. Production/live smoke remains NOT RUN. |
| CP-EGZ-06 | PASS (reporting only) | Evidence appended here and published to existing PR #14; acceptance of real-data MVP is still BLOCKED, not implied by reporting completion. |

### Access preflight (presence only, values never emitted)

Environment variables `GOSZAKUP_TOKEN`, `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`: ABSENT. Standard Wrangler OAuth config files under
`~/.config/.wrangler/config/default.toml` and `~/.wrangler/config/default.toml`:
ABSENT. `backend/.env`, `backend/.dev.vars` and root `.dev.vars`: ABSENT.
These local checks do NOT establish whether a Secret exists remotely.
No secret-list API request could be made from this permitted environment; no
production settings or Secrets were read or changed. Do not infer Secret absence
in Cloudflare from missing local authentication.

Permitted outbound hosts are GitHub and npm/Python registries, not
`ows.goszakup.gov.kz`, the procurement portal, or Cloudflare API/documentation.
No proxy, alternate host, CI secret extraction or other network bypass was used.
The endpoint/auth review therefore confirms code intent only: POST to the official
v3 URL recorded by CP-04, backend Bearer token, HTTPS, redirect rejection, one
bounded query, timeout, explicit HTTP/GraphQL failures and token redaction.

### Fresh local smoke and probe evidence

At 2026-11-04 11:39:38 UTC local workerd returned:

- `/api/v1/health`: 200, `status=ok`.
- `/api/v1/lots/source`: 200, `mode=goszakup`, `live=true`. Here `live` means
  configured mode only; it is NOT proof of upstream connectivity/readiness.
- `/api/v1/lots`: 503, `Lot source is temporarily unavailable`.
- `/api/v1/lots?q=мебель&maxAmount=500000&region=Алматы`: same generic 503,
  no fixture response. This is a negative smoke, NOT furniture-search acceptance.

Existing probe was invoked; it reported `GOSZAKUP_TOKEN is not set` and `NOT RUN`.
The pnpm recursive wrapper reported a lifecycle failure (expected for a skipped
probe); direct `node backend/dist/probe/goszakup.probe.js` confirmed the probe's
explicit SKIPPED exit code 2. No upstream fetch was made.

Worker dry-run passed at 3076.57 KiB / gzip 574.17 KiB, no upload. Wrangler local
startup warned about unavailable optional Request.cf metadata as before. Running
`probe:goszakup` rebuilds/cleans dist; while the local watcher was still running
this caused transient `Could not resolve ./dist/worker.js` reload errors after
the successful HTTP assertions. This was a local command-order artifact, not a
production error. The local server was stopped; avoid rebuilding dist concurrently
with Worker smoke. No long-lived service is left running.

### CI and next permitted action

Prior code head `2770fbb07c2199d0daf6e8927486f01b003cce04` has green
[Quality gates](https://github.com/Murkin1980/tender-assistant/actions/runs/41810573949/job/126508494714)
and [Docker smoke](https://github.com/Murkin1980/tender-assistant/actions/runs/41810573949/job/126508845627).
Fresh CI for this evidence-only follow-up is linked in PR #14 and the final report.

To unblock live acceptance, provide an approved execution environment whose
network policy permits official OWS/docs and read-only Cloudflare metadata calls,
with a securely injected OWS token and read-only Cloudflare access. Do not paste
credentials in chat, issue or PR. Only then inspect Worker/Secret names without
values, perform one bounded read and furniture query through the existing client,
verify public lot IDs/normalization and record non-secret evidence. This does not
authorize merge, deployment, production secret writes or organization actions.
