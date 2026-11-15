#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'Production smoke failed: %s\n' "$1" >&2
  exit 1
}

: "${PRODUCTION_ORIGIN:?Set PRODUCTION_ORIGIN to the HTTPS app origin}"
: "${SMOKE_LOT_ID:?Set SMOKE_LOT_ID to a live Goszakup lot from /lots with a text-native official document}"

origin="${PRODUCTION_ORIGIN%/}"
[[ "$origin" =~ ^https://[A-Za-z0-9.-]+$ ]] || fail 'PRODUCTION_ORIGIN must be an HTTPS origin without a path or trailing slash'
[[ "$SMOKE_LOT_ID" =~ ^goszakup:[0-9]+$ ]] || fail 'SMOKE_LOT_ID must look like goszakup:<numeric-id>'

operator_username="${OPERATOR_USERNAME:-}"
[[ -n "$operator_username" ]] || read -r -p 'Operator username: ' operator_username
[[ "$operator_username" =~ ^[A-Za-z0-9._-]+$ ]] || fail 'operator username may contain only letters, numbers, dot, underscore, and hyphen'

operator_password="${OPERATOR_PASSWORD:-}"
if [[ -z "$operator_password" ]]; then
  read -r -s -p 'Operator password: ' operator_password
  printf '\n'
fi
[[ "$operator_password" =~ ^[A-Za-z0-9_-]{20,}$ ]] ||
  fail 'use a 20+ character URL-safe operator password (letters, numbers, underscore, hyphen)'

host="${origin#https://}"
tmp_dir="$(mktemp -d)"
chmod 700 "$tmp_dir"
auth_file="${tmp_dir}/operator.netrc"
list_file="${tmp_dir}/lots.html"
detail_file="${tmp_dir}/lot-detail.html"
trap 'rm -rf "$tmp_dir"; unset operator_password' EXIT
umask 077
printf 'machine %s login %s password %s\n' "$host" "$operator_username" "$operator_password" >"$auth_file"

# Verify that the edge rejects anonymous access before sending the operator credentials.
unauthenticated_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --connect-timeout 5 --max-time 15 "${origin}/lots" || true)"
[[ "$unauthenticated_status" == '401' ]] ||
  fail "expected HTTP 401 for unauthenticated /lots, received HTTP ${unauthenticated_status}"
printf 'PASS private access: anonymous /lots returns HTTP 401.\n'

curl --fail --silent --show-error --basic --netrc-file "$auth_file" --proto '=https' \
  --connect-timeout 5 --max-time 30 "${origin}/api/v1/ready" -o "${tmp_dir}/ready.json" ||
  fail 'authenticated frontend/backend readiness endpoint did not return HTTP 200'
grep -Fq '"status":"ready"' "${tmp_dir}/ready.json" ||
  fail 'readiness response did not report status=ready'

curl --fail --silent --show-error --basic --netrc-file "$auth_file" --proto '=https' \
  --connect-timeout 5 --max-time 60 "${origin}/lots" -o "$list_file" ||
  fail 'authenticated /lots page did not return HTTP 200'
grep -Fq 'data-source="goszakup"' "$list_file" || fail '/lots did not identify Goszakup as the active source'
grep -Fq '>LIVE</strong>' "$list_file" || fail '/lots did not render the LIVE source indicator'
encoded_lot_id="${SMOKE_LOT_ID/:/%3A}"
grep -Fq "/lots/${encoded_lot_id}" "$list_file" ||
  fail 'selected smoke lot is not present in the bounded live /lots result'
printf 'PASS live list: /lots is LIVE and contains %s.\n' "$SMOKE_LOT_ID"

curl --fail --silent --show-error --basic --netrc-file "$auth_file" --proto '=https' \
  --connect-timeout 5 --max-time 90 "${origin}/lots/${encoded_lot_id}" -o "$detail_file" ||
  fail 'authenticated live lot detail did not return HTTP 200'
grep -Fq 'data-source="goszakup"' "$detail_file" || fail 'detail page did not identify Goszakup as its source'
grep -Fq 'Документы закупки' "$detail_file" || fail 'detail page is missing the official documents section'
grep -Fq 'class="document-link"' "$detail_file" || fail 'selected live lot has no official document link'
grep -Eq 'href="https://([A-Za-z0-9-]+\.)?goszakup\.gov\.kz/' "$detail_file" ||
  fail 'document link is not on an official Goszakup host'
grep -Fq 'Требования' "$detail_file" || fail 'detail page is missing the requirements section'
grep -Eq 'data-requirements="(AVAILABLE|PARTIAL)"' "$detail_file" ||
  fail 'no text-native requirements were extracted; select a lot with a supported PDF/DOCX and retry'
grep -Fq 'class="requirement-item"' "$detail_file" || fail 'requirements section contains no source-linked item'
grep -Fq 'Документ:' "$detail_file" || fail 'extracted requirement has no source-document reference'
grep -Eq '(Стр\.|стр\.|Абз\.|Табл\.)' "$detail_file" ||
  fail 'extracted requirement has no source locator'
printf 'PASS detail/documents/requirements: %s has an official Goszakup document and source-located extraction.\n' \
  "$SMOKE_LOT_ID"
printf 'PASS readiness: authenticated frontend proxy reports the backend ready.\n'
