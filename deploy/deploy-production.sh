#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/production/compose.yml"
ENV_FILE="${TENDER_ASSISTANT_ENV_FILE:-/etc/tender-assistant/production.env}"

fail() {
  printf 'Deployment blocked: %s\n' "$1" >&2
  exit 1
}

for command in docker git curl stat awk realpath; do
  command -v "$command" >/dev/null 2>&1 || fail "required command not found: ${command}"
done

build_release=true
if [[ "$#" -eq 0 ]]; then
  :
elif [[ "$#" -eq 2 && "$1" == '--rollback' ]]; then
  build_release=false
  release_sha="$2"
  [[ "$release_sha" =~ ^[0-9a-f]{40}$ ]] || fail 'rollback requires a full 40-character commit SHA'
  git -C "$REPO_ROOT" cat-file -e "${release_sha}^{commit}" 2>/dev/null ||
    fail 'rollback commit is not present in this checkout; fetch it first'
else
  fail 'usage: deploy/deploy-production.sh [--rollback <full-commit-sha>]'
fi

[[ -f "$ENV_FILE" ]] || fail "production env file not found: ${ENV_FILE}"
ENV_FILE="$(realpath -e "$ENV_FILE")"
[[ -z "${GOSZAKUP_TOKEN+x}" ]] || fail 'unset GOSZAKUP_TOKEN; production reads it only from the mounted secret file'
grep -Eq '^[[:space:]]*GOSZAKUP_TOKEN[[:space:]]*=' "$ENV_FILE" &&
  fail 'remove GOSZAKUP_TOKEN from production.env; use GOSZAKUP_TOKEN_FILE only'
case "$ENV_FILE" in
  "$REPO_ROOT"/*) fail 'production env file must be outside the checkout' ;;
esac

mode="$(stat -c '%a' "$ENV_FILE")"
[[ "$mode" == '600' || "$mode" == '400' ]] || fail 'production env file must have mode 0600 or 0400'

read_setting() {
  local name="$1"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); sub(/\r$/, ""); print; exit }' "$ENV_FILE"
}

app_domain="$(read_setting APP_DOMAIN)"
app_origin="$(read_setting APP_ORIGIN)"
token_file="$(read_setting GOSZAKUP_TOKEN_FILE)"
[[ "$app_domain" =~ ^[A-Za-z0-9.-]+$ ]] || fail 'APP_DOMAIN must be a DNS hostname'
[[ "$app_origin" == "https://${app_domain}" ]] || fail 'APP_ORIGIN must equal https://APP_DOMAIN with no trailing slash'
[[ "$token_file" == /* ]] || fail 'GOSZAKUP_TOKEN_FILE must be an absolute path'
[[ -f "$token_file" && -s "$token_file" && -r "$token_file" ]] || fail 'Goszakup token file must exist and be non-empty'
token_file="$(realpath -e "$token_file" 2>/dev/null)" || fail 'Goszakup token file path is not valid'
case "$token_file" in
  "$REPO_ROOT"/*) fail 'Goszakup token file must be outside the checkout' ;;
esac
token_mode="$(stat -c '%a' "$token_file")"
[[ "$token_mode" == '600' || "$token_mode" == '400' ]] || fail 'Goszakup token file must have mode 0600 or 0400'

worktree="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=normal)"
[[ -z "$worktree" ]] || fail 'deploy only from a clean checkout; commit or remove local changes first'
if [[ "$build_release" == true ]]; then
  release_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
else
  docker image inspect "tender-assistant-backend:${release_sha}" \
    "tender-assistant-frontend:${release_sha}" >/dev/null 2>&1 ||
    fail 'rollback images are not available locally; keep prior release images or build that release first'
fi

compose() {
  RELEASE_SHA="$release_sha" docker compose \
    --project-name tender-assistant \
    --env-file "$ENV_FILE" \
    --file "$COMPOSE_FILE" \
    "$@"
}

# `--quiet` validates required values and the secret mount without printing resolved config.
compose config --quiet
if [[ "$build_release" == true ]]; then
  printf 'Building release %s from the clean checkout...\n' "$release_sha"
  compose build --pull
  printf 'Starting the live Goszakup runtime...\n'
  compose up --detach --remove-orphans --wait --wait-timeout 120
else
  printf 'Restoring known-good release %s from the local image cache...\n' "$release_sha"
  compose up --detach --no-build --remove-orphans --wait --wait-timeout 120
fi

# Caddy provisions/renews the certificate automatically. An unauthenticated 401 proves both
# HTTPS routing and the private access boundary without placing an operator password in a command.
origin_status='000'
for attempt in {1..30}; do
  origin_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    --connect-timeout 5 --max-time 10 "${app_origin}/lots" 2>/dev/null || true)"
  if [[ "$origin_status" == '401' ]]; then
    break
  fi
  if [[ "$origin_status" != '000' && "$origin_status" != '502' && "$origin_status" != '503' ]]; then
    fail "expected private HTTPS endpoint to return 401 without credentials, got HTTP ${origin_status}"
  fi
  if [[ "$attempt" -lt 30 ]]; then sleep 2; fi
done
[[ "$origin_status" == '401' ]] || fail 'HTTPS/private-access check did not become ready within 60 seconds'

printf 'Release %s is running at %s; unauthenticated /lots is correctly denied (HTTP 401).\n' \
  "$release_sha" "$app_origin"
printf 'Run deploy/smoke-production.sh with operator credentials and a document-bearing live lot to complete the live data smoke.\n'
