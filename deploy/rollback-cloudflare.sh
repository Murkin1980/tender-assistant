#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "$#" -ne 2 ]]; then
  printf 'usage: deploy/rollback-cloudflare.sh <backend-version-id> <frontend-version-id>\n' >&2
  exit 1
fi

backend_version="$1"
frontend_version="$2"
version_pattern='^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
[[ "$backend_version" =~ $version_pattern ]] || { printf 'invalid backend version id\n' >&2; exit 1; }
[[ "$frontend_version" =~ $version_pattern ]] || { printf 'invalid frontend version id\n' >&2; exit 1; }

pnpm --dir "$ROOT" exec wrangler rollback "$backend_version" \
  --config "$ROOT/backend/wrangler.jsonc" --message "CP-13 tested rollback"
pnpm --dir "$ROOT" exec wrangler rollback "$frontend_version" \
  --config "$ROOT/frontend/wrangler.jsonc" --message "CP-13 tested rollback"

printf 'Rolled back backend to %s and frontend to %s.\n' "$backend_version" "$frontend_version"
