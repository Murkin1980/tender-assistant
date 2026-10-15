#!/usr/bin/env bash
# Validate the production Compose contract with a throwaway sentinel secret; never use live creds.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="${ROOT}/deploy/production/compose.yml"
CADDYFILE="${ROOT}/deploy/production/Caddyfile"
TMP_DIR="$(mktemp -d)"
chmod 700 "$TMP_DIR"

SECRET_SENTINEL='CP13_SYNTHETIC_GOSZAKUP_SECRET_NEVER_USE_IN_PRODUCTION'
TOKEN_FILE="${TMP_DIR}/goszakup-token"
ENV_FILE="${TMP_DIR}/production.env"
CONFIG_FILE="${TMP_DIR}/compose.json"
CADDY_LOG="${TMP_DIR}/caddy-validate.log"
printf '%s' "$SECRET_SENTINEL" >"$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"
cat >"$ENV_FILE" <<'EOF'
APP_DOMAIN=app.example.test
APP_ORIGIN=https://app.example.test
ACME_EMAIL=operator@example.test
OPERATOR_USERNAME=operator
OPERATOR_PASSWORD_HASH='$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
EOF
printf 'GOSZAKUP_TOKEN_FILE=%s\n' "$TOKEN_FILE" >>"$ENV_FILE"
chmod 600 "$ENV_FILE"

compose() {
  RELEASE_SHA=0123456789abcdef0123456789abcdef01234567 docker compose \
    --progress plain \
    --project-name tender-assistant-cp13-check \
    --env-file "$ENV_FILE" \
    --file "$COMPOSE_FILE" \
    "$@"
}

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

compose config --quiet
compose config --format json >"$CONFIG_FILE"
EXPECTED_GOSZAKUP_TOKEN_FILE="$TOKEN_FILE" node - "$CONFIG_FILE" "$SECRET_SENTINEL" "$CADDYFILE" <<'NODE'
const fs = require('node:fs');
const [configPath, secretSentinel, caddyfilePath] = process.argv.slice(2);
const configText = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(configText);
const { services, secrets } = config;
const errors = [];
const backend = services.backend;
const frontend = services.frontend;
const edge = services.edge;

if (backend?.environment?.TENDER_LOT_SOURCE !== 'goszakup') {
  errors.push('production backend must explicitly select TENDER_LOT_SOURCE=goszakup');
}
if (backend?.environment?.CORS_ORIGIN !== 'https://app.example.test') {
  errors.push('production CORS must be the exact HTTPS frontend origin');
}
if (backend?.environment?.GOSZAKUP_TOKEN_FILE !== '/run/secrets/goszakup_token') {
  errors.push('backend must read the mounted goszakup_token secret file');
}
if ('GOSZAKUP_TOKEN' in (backend?.environment ?? {})) {
  errors.push('the Goszakup token must not be passed as a container environment value');
}
if (!backend?.secrets?.some((secret) => secret.source === 'goszakup_token')) {
  errors.push('only the backend must receive the Goszakup Docker secret');
}
if (frontend?.environment?.BACKEND_INTERNAL_URL !== 'http://backend:3000') {
  errors.push('frontend must use the private backend service URL');
}
if (Object.keys(frontend?.environment ?? {}).some((key) => key.startsWith('GOSZAKUP_'))) {
  errors.push('Goszakup settings must not be present in the frontend environment');
}
if (backend?.ports?.length || frontend?.ports?.length) {
  errors.push('backend and frontend must not publish host ports');
}
const edgePorts = (edge?.ports ?? []).map((port) => String(port.published)).sort();
if (edgePorts.join(',') !== '443,80') {
  errors.push('only the private HTTPS edge may publish ports 80 and 443');
}
// `docker compose config` doubles dollar signs in serialized output so it can be safely re-used.
const renderedPasswordHash = edge?.environment?.OPERATOR_PASSWORD_HASH?.replaceAll('$$', '$');
if (renderedPasswordHash !== '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy') {
  errors.push('Caddy test-only bcrypt hash was modified or dropped by Compose');
}
if (configText.includes(secretSentinel)) {
  errors.push('the contents of the secret file appeared in rendered Compose configuration');
}
const caddyfile = fs.readFileSync(caddyfilePath, 'utf8');
for (const required of ['basic_auth {', 'header_up -Authorization', 'reverse_proxy frontend:3000']) {
  if (!caddyfile.includes(required)) errors.push(`Caddyfile is missing ${required}`);
}
if (secrets?.goszakup_token?.file !== process.env.EXPECTED_GOSZAKUP_TOKEN_FILE) {
  // The expected file path is passed below without printing its contents.
  errors.push('Compose did not resolve the external Goszakup secret file');
}

if (errors.length) {
  for (const error of errors) console.error(`::error::Production Compose contract: ${error}`);
  process.exit(1);
}
NODE

printf 'Production Compose security/configuration contract passed.\n'
# Parse the Caddyfile using the pinned runtime image. Capture output so credentials/config are not
# dumped into CI logs if validation fails; the file contains only synthetic test values here.
if ! compose run --rm --no-deps edge validate --config /etc/caddy/Caddyfile --adapter caddyfile \
  >"$CADDY_LOG" 2>&1; then
  if grep -Fq "$SECRET_SENTINEL" "$CADDY_LOG"; then
    printf '::error::Synthetic Goszakup token appeared in Caddy validation output.\n' >&2
    exit 1
  fi
  printf '::error::Caddy configuration validation failed. Synthetic-only diagnostic follows.\n'
  printf '::error::Caddy raw output base64: %s\n' "$(base64 -w0 "$CADDY_LOG")"
  line=''
  while IFS= read -r line || [[ -n "$line" ]]; do
    printf '::error::Caddy validation: %s\n' "$line"
  done < <(tr '\r' '\n' <"$CADDY_LOG")
  exit 1
fi
if grep -Fq "$SECRET_SENTINEL" "$CADDY_LOG"; then
  printf '::error::Synthetic Goszakup token appeared in Caddy validation output.\n' >&2
  exit 1
fi

printf 'Production Compose and Caddy smoke passed (synthetic, throwaway secret only).\n'
