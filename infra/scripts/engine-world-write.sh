#!/usr/bin/env bash
# ============================================
# engine-world-write.sh — Shared helper: write one surface to engine_world
#
# Used by deploy-conductor pipeline scripts (promote-preview, drift-check,
# smoke-probe) and ci-incident-conductor scripts to emit platform observations.
#
# Calls engine_world_observe_platform SECURITY DEFINER RPC via Supabase
# REST API with service_role JWT — same transport as engine-world-refresh.sh.
#
# Design: fire-and-forget. All failures are soft (warnings, non-zero exit)
# so callers MUST use: engine-world-write.sh ... || true
# Never let an engine_world write block or fail a pipeline gate.
#
# Usage:
#   ./infra/scripts/engine-world-write.sh \
#     <surface_id> <surface_type> <status> <details_json> <ttl_seconds> <observed_by>
#
# Args:
#   surface_id    — dot-notation surface name, e.g. "deploy.preview.lkg"
#   surface_type  — "service" | "migration" | "pr" | "worktree" | "deploy"
#   status        — "green" | "yellow" | "red" | "unknown"
#   details_json  — JSON string, e.g. '{"sha":"abc123"}' or '{}'
#   ttl_seconds   — integer, e.g. 3600 (1h) or 86400 (24h)
#   observed_by   — source label, e.g. "deploy-conductor" | "drift-check" | "smoke-probe"
#
# Environment (resolved by `op run --env-file=.env.template`):
#   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL — Supabase API base URL
#   SUPABASE_SERVICE_ROLE_KEY                — service_role JWT
#
# Exit codes:
#   0 — RPC call succeeded (HTTP 200 or 204)
#   1 — argument error or RPC failure (caller should use || true)
# ============================================

set -uo pipefail

if [ "$#" -ne 6 ]; then
  echo "engine-world-write: usage: $0 <surface_id> <surface_type> <status> <details_json> <ttl_seconds> <observed_by>" >&2
  exit 1
fi

SURFACE_ID="$1"
SURFACE_TYPE="$2"
STATUS="$3"
DETAILS_JSON="$4"
TTL_SECONDS="$5"
OBSERVED_BY="$6"

# ── Resolve Supabase API URL ──────────────────────────────────────────────────
SUPABASE_API_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
if [ -z "$SUPABASE_API_URL" ]; then
  # Local dev fallback — supabase start default
  SUPABASE_API_URL="http://127.0.0.1:54321"
fi
SUPABASE_API_URL="${SUPABASE_API_URL%/}"  # strip trailing slash

# ── Resolve service_role key ──────────────────────────────────────────────────
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "engine-world-write: SUPABASE_SERVICE_ROLE_KEY not set — skipping write for $SURFACE_ID" >&2
  exit 1
fi

# ── Build JSON payload ────────────────────────────────────────────────────────
# Validate details_json is parseable JSON before constructing payload
if ! echo "$DETAILS_JSON" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
  echo "engine-world-write: details_json is not valid JSON for $SURFACE_ID — using {}" >&2
  DETAILS_JSON="{}"
fi

PAYLOAD=$(python3 -c "
import json, sys

print(json.dumps({
  'p_surface_id':   sys.argv[1],
  'p_surface_type': sys.argv[2],
  'p_status':       sys.argv[3],
  'p_details':      json.loads(sys.argv[4]),
  'p_ttl_seconds':  int(sys.argv[5]),
  'p_observed_by':  sys.argv[6],
}))" \
  "$SURFACE_ID" "$SURFACE_TYPE" "$STATUS" "$DETAILS_JSON" "$TTL_SECONDS" "$OBSERVED_BY" 2>/dev/null)

if [ -z "$PAYLOAD" ]; then
  echo "engine-world-write: failed to build JSON payload for $SURFACE_ID" >&2
  exit 1
fi

# ── Call RPC ──────────────────────────────────────────────────────────────────
HTTP_CODE=$(curl -sf --max-time 10 \
  -X POST "${SUPABASE_API_URL}/rest/v1/rpc/engine_world_observe_platform" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -o /dev/null \
  -w "%{http_code}" \
  --data "$PAYLOAD" 2>/dev/null || echo "000")

case "$HTTP_CODE" in
  200|204)
    exit 0
    ;;
  *)
    echo "engine-world-write: RPC returned HTTP $HTTP_CODE for surface $SURFACE_ID" >&2
    exit 1
    ;;
esac
