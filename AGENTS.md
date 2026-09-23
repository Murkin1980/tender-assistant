<!-- MPE:SCOPE-CHANGE-CONTROL:START -->
## Mandatory first read — MPE Scope & Change Control

Before planning, coding, refactoring, dependency changes, testing strategy, deployment, or checkpoint execution, read:

- `docs/governance/SCOPE-CHANGE-CONTROL.md`

Read it before project-specific source-of-truth documents. Then follow this repository's local rules and the current checkpoint/spec.

The scope policy governs minimal change, reuse, checkpoint boundaries, deep-change, testing, evidence, change-size/merge-pressure, merge/deploy authority, and stopping conditions.

If a local rule appears to conflict with the scope policy, apply the documented source-of-truth priority. Do not silently weaken either rule; surface a deep-change conflict when required.
<!-- MPE:SCOPE-CHANGE-CONTROL:END -->

# Project agent instructions

## Shared unfinished-project deployment ritual

This repository is still under active development. Before every substantial change, read this file and the project README/session notes, check `git status`, preserve unrelated changes, and identify the exact build and deployment target.

Before claiming completion: run the project lint/typecheck/tests and a production build; commit and push the exact tested state; deploy only from a clean checkout; smoke-test the real public URL and the main user journey on desktop and mobile. A screenshot or local preview alone is not proof of a successful deployment.

For Cloudflare/OpenNext projects: prefer the adapter-supported production builder; if `Failed to load chunk server/chunks/ssr/...` occurs, check current OpenNext troubleshooting and use a Webpack build when recommended. Avoid deploying from OneDrive or paths with Cyrillic/spaces when artifacts behave inconsistently; use a clean ASCII-only clone under `C:\tmp`. After DNS/custom-domain creation, distinguish stale local `NXDOMAIN` cache from a server failure by checking a public resolver, direct HTTPS status, Worker logs, and then a fresh browser process.

Never weaken database authorization to make missing data appear. For OAuth migrations, verify user IDs, organization membership, ownership fields, RLS, storage access, and record counts. Never print or commit secrets.