#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_CONFIG="${ROOT}/backend/wrangler.jsonc"
FRONTEND_CONFIG="${ROOT}/frontend/wrangler.jsonc"

fail() {
  printf 'Cloudflare deployment blocked: %s\n' "$1" >&2
  exit 1
}

for command in git node pnpm; do
  command -v "$command" >/dev/null 2>&1 || fail "required command not found: ${command}"
done

[[ -z "$(git -C "$ROOT" status --porcelain --untracked-files=normal)" ]] ||
  fail 'deploy only from a clean checkout'

release_sha="$(git -C "$ROOT" rev-parse HEAD)"
[[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail 'could not resolve a full git commit SHA'

secret_names="$(pnpm --dir "$ROOT" exec wrangler secret list --config "$BACKEND_CONFIG")"
grep -Fq 'GOSZAKUP_TOKEN' <<<"$secret_names" ||
  fail 'GOSZAKUP_TOKEN is not provisioned as a secret on tender-assistant-api'

pnpm --dir "$ROOT" --filter @tender-assistant/backend build
pnpm --dir "$ROOT" exec wrangler deploy --config "$BACKEND_CONFIG" \
  --strict --tag "$release_sha" --message "git:${release_sha}"

pnpm --dir "$ROOT" --filter @tender-assistant/frontend build:cloudflare
pnpm --dir "$ROOT" exec wrangler deploy --config "$FRONTEND_CONFIG" \
  --strict --tag "$release_sha" --message "git:${release_sha}"

printf 'Cloudflare release %s deployed to https://tender.salamat-mebel.kz\n' "$release_sha"
