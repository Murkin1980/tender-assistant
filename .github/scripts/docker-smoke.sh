#!/usr/bin/env bash
#
# Docker smoke test for the tender-assistant bootstrap environment.
#
# Run by .github/workflows/ci.yml (job: docker-smoke) after:
#
#   docker compose up --build -d
#
# The script:
#   1. Waits for the backend health endpoint (http://localhost:3000/api/v1/health)
#      and the frontend proxy endpoint (http://localhost:3001/api/v1/health)
#      using a bounded retry loop (30 attempts x 2 seconds = up to 60s per
#      service). It never relies on a single fixed `sleep`.
#   2. Validates that both HTTP 200 responses are JSON objects with:
#         {
#           "status": "ok",
#           "service": "tender-assistant-backend",
#           "timestamp": "<valid ISO-8601 string>"
#         }
#      Payload validation uses Node.js (already available on the runner),
#      so no extra dependencies such as `jq` are introduced.
#   3. On any failure prints `docker compose ps` and the last 200 log lines
#      of the backend and frontend containers, then exits non-zero so the
#      workflow fails.
#
# This script never tears containers down: cleanup is a separate workflow
# step (`docker compose down -v --remove-orphans`) that always runs with
# `if: always()`.
#
# Requirements: bash, curl, Node.js.

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:3000/api/v1/health}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001/api/v1/health}"
# 30 attempts x 2 seconds = up to 60 seconds of waiting per service.
MAX_ATTEMPTS="${MAX_ATTEMPTS:-30}"
ATTEMPT_INTERVAL_SECONDS="${ATTEMPT_INTERVAL_SECONDS:-2}"

fail() {
  local reason="$1"

  echo ""
  echo "::error::${reason}"
  echo ""
  echo "---- docker compose ps ----"
  docker compose ps 2>&1 || echo "(docker compose ps failed or is unavailable)"
  echo ""
  echo "---- docker compose logs --no-color --tail=200 backend ----"
  docker compose logs --no-color --tail=200 backend 2>&1 || echo "(backend logs unavailable)"
  echo ""
  echo "---- docker compose logs --no-color --tail=200 frontend ----"
  docker compose logs --no-color --tail=200 frontend 2>&1 || echo "(frontend logs unavailable)"
  echo ""
  echo "Smoke test failed: ${reason}"
  exit 1
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempt

  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
    if curl --fail --silent --show-error --output /dev/null "${url}"; then
      echo "${label} is healthy (attempt ${attempt}/${MAX_ATTEMPTS}): ${url}"
      return 0
    fi

    if [ "${attempt}" -eq "${MAX_ATTEMPTS}" ]; then
      fail "${label} did not become healthy within $((MAX_ATTEMPTS * ATTEMPT_INTERVAL_SECONDS))s: ${url}"
    fi

    sleep "${ATTEMPT_INTERVAL_SECONDS}"
  done
}

validate_health_payload() {
  local url="$1"
  local label="$2"
  local body

  if ! body="$(curl --fail --show-error --silent "${url}")"; then
    fail "${label} health endpoint returned a non-2xx response: ${url}"
  fi

  if ! printf '%s' "${body}" | node -e '
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        console.error(`Health payload is not valid JSON: ${data}`);
        process.exit(1);
      }

      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        console.error(`Health payload must be a JSON object, got: ${data}`);
        process.exit(1);
      }

      const errors = [];

      if (payload.status !== "ok") {
        errors.push(`"status" must be "ok", got ${JSON.stringify(payload.status)}`);
      }

      if (payload.service !== "tender-assistant-backend") {
        errors.push(`"service" must be "tender-assistant-backend", got ${JSON.stringify(payload.service)}`);
      }

      const timestamp = payload.timestamp;
      const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
      const isIso8601 =
        typeof timestamp === "string" &&
        isoPattern.test(timestamp) &&
        !Number.isNaN(Date.parse(timestamp));

      if (!isIso8601) {
        errors.push(`"timestamp" must be a valid ISO-8601 string, got ${JSON.stringify(timestamp)}`);
      }

      if (errors.length > 0) {
        console.error(`Invalid health payload from ${process.argv[1]}:\n${errors.join("\n")}`);
        process.exit(1);
      }

      console.log(`Health payload is valid: ${data}`);
    });
  ' "${url}"; then
    fail "${label} health payload does not match the expected contract: ${url}"
  fi
}

echo "Smoke test targets:"
echo "  backend:  ${BACKEND_URL}"
echo "  frontend: ${FRONTEND_URL}"
echo ""

echo "Waiting for the backend health endpoint..."
wait_for_url "${BACKEND_URL}" "Backend"
validate_health_payload "${BACKEND_URL}" "Backend"

echo ""
echo "Waiting for the frontend health proxy endpoint..."
wait_for_url "${FRONTEND_URL}" "Frontend"
validate_health_payload "${FRONTEND_URL}" "Frontend"

echo ""
echo "Docker smoke test passed: backend and frontend health endpoints returned the expected payload."
