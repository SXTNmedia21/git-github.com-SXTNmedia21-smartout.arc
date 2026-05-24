#!/usr/bin/env bash
# ============================================
# seed-prod-service-keys.sh — Idempotent prod service-key seeder
#
# Reads each service entry from services/_shared/expected-keys.json,
# fetches the raw API key from 1Password (smartout_ai_prod vault),
# SHA-256 hashes it, and upserts a row into public.platform_api_key
# if one doesn't already exist for that hash.
#
# WHEN TO RUN:
#   - After any prod db-reset (new database = empty platform_api_key)
#   - After adding a new service to expected-keys.json
#   - After rotating a service key in 1Password (old hash won't match)
#
# REQUIREMENTS:
#   - op CLI authenticated (1Password) with smartout_ai_prod vault access
#   - psql available (postgresql-client)
#   - jq available
#   - openssl available
#   - SUPABASE_PROJECT_REF env var set (Supabase prod project ref)
#   - PGPASSWORD env var set (Supabase DB password)
#   - PLATFORM_ADMIN_USER_ID env var set (user_identity.user_id of godmode user)
#     OR pass as --admin-user-id <uuid>
#
# USAGE:
#   op run --env-file=.env.template -- ./infra/scripts/seed-prod-service-keys.sh
#   ./infra/scripts/seed-prod-service-keys.sh --dry-run
#
# EXIT CODES:
#   0 — all services seeded or already present
#   1 — at least one service failed
#   2 — prerequisite check failed (missing tool, no auth)
#
# Refs: ADR-0411, BUG-009
# Pattern: mirrors ADR-0388 (cron-secret Vault seed via postgres pooler)
# ============================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REGISTRY="$REPO_ROOT/services/_shared/expected-keys.json"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
LOGFILE="/tmp/seed-prod-service-keys-${TIMESTAMP}.log"
DRY_RUN=false
ADMIN_USER_ID="${PLATFORM_ADMIN_USER_ID:-}"

# ── Arg parsing ─────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --admin-user-id=*) ADMIN_USER_ID="${arg#--admin-user-id=}" ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "$*" | tee -a "$LOGFILE"; }
log_pass() { log "  ${GREEN}✓${NC}  $*"; }
log_fail() { log "  ${RED}✗${NC}  $*"; }
log_skip() { log "  ${YELLOW}~${NC}  $*"; }
log_info() { log "  ${CYAN}→${NC}  $*"; }

# ── Prerequisite checks ──────────────────────────────────────────────────────
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🔑 SEED PROD SERVICE KEYS"
if [ "$DRY_RUN" = "true" ]; then
  log "   (DRY-RUN mode — no writes)"
fi
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
log "Log: $LOGFILE"
log ""

PREREQ_OK=true

if ! command -v jq >/dev/null 2>&1; then
  log_fail "jq not found — install jq"
  PREREQ_OK=false
fi

if ! command -v openssl >/dev/null 2>&1; then
  log_fail "openssl not found"
  PREREQ_OK=false
fi

if ! command -v psql >/dev/null 2>&1; then
  log_fail "psql not found — install postgresql-client"
  PREREQ_OK=false
fi

if ! command -v op >/dev/null 2>&1; then
  log_fail "1Password CLI (op) not found"
  PREREQ_OK=false
fi

if [ ! -f "$REGISTRY" ]; then
  log_fail "Registry not found: $REGISTRY"
  PREREQ_OK=false
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  log_fail "SUPABASE_PROJECT_REF env var not set"
  PREREQ_OK=false
fi

if [ -z "${PGPASSWORD:-}" ]; then
  log_fail "PGPASSWORD env var not set"
  PREREQ_OK=false
fi

if [ "$PREREQ_OK" = "false" ]; then
  log ""
  log_fail "Prerequisite checks failed. Run via:"
  log "   op run --env-file=.env.template -- ./infra/scripts/seed-prod-service-keys.sh"
  exit 2
fi

# Validate jq can parse the registry
if ! jq empty "$REGISTRY" 2>/dev/null; then
  log_fail "Registry is not valid JSON: $REGISTRY"
  exit 2
fi

# ── Admin user ID resolution ─────────────────────────────────────────────────
# platform_api_key.created_by is NOT NULL — must be a valid user_identity.user_id.
# Service keys have no workspace; godmode user is the canonical platform admin.
# Set PLATFORM_ADMIN_USER_ID in env or pass --admin-user-id.
# Alternatively, the script queries prod to find the first godmode user.

PSQL_CMD="psql -v ON_ERROR_STOP=1 \
  -h aws-1-eu-west-1.pooler.supabase.com \
  -p 5432 \
  -U postgres.${SUPABASE_PROJECT_REF} \
  -d postgres"

if [ -z "$ADMIN_USER_ID" ]; then
  log_info "Resolving godmode admin user from prod..."
  ADMIN_USER_ID=$(${PSQL_CMD} -tAc \
    "SELECT user_id FROM public.user_identity WHERE is_godmode = true LIMIT 1;" 2>>"$LOGFILE" || true)
  if [ -z "$ADMIN_USER_ID" ]; then
    log_fail "Could not resolve admin user ID from prod. Set PLATFORM_ADMIN_USER_ID or pass --admin-user-id=<uuid>"
    exit 2
  fi
  log_pass "Resolved admin user: $ADMIN_USER_ID"
fi

# ── Process each service ─────────────────────────────────────────────────────
SERVICE_COUNT=$(jq 'length' "$REGISTRY")
log "Processing $SERVICE_COUNT service(s) from registry..."
log ""

PASS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0
RESULTS=()

for i in $(seq 0 $((SERVICE_COUNT - 1))); do
  SERVICE_NAME=$(jq -r ".[$i].name" "$REGISTRY")
  OP_PATH=$(jq -r ".[$i].op_path" "$REGISTRY")
  KEY_TYPE=$(jq -r ".[$i].key_type" "$REGISTRY")
  ENVIRONMENT=$(jq -r ".[$i].environment" "$REGISTRY")
  SCOPES_JSON=$(jq -r ".[$i].scopes | tojson" "$REGISTRY")
  SCOPES_PG=$(jq -r '.[$i].scopes | map("\"" + . + "\"") | join(",")' --argjson i "$i" "$REGISTRY")

  log "[$((i+1))/$SERVICE_COUNT] $SERVICE_NAME"

  # Fetch raw key from 1Password — never echo to stdout
  RAW_KEY=$(op read "$OP_PATH" 2>>"$LOGFILE" || true)
  if [ -z "$RAW_KEY" ]; then
    log_fail "$SERVICE_NAME — failed to read from 1Password: $OP_PATH"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("FAIL|$SERVICE_NAME|1Password read failed")
    log ""
    continue
  fi

  # SHA-256 hex digest (same as Node.js createHash('sha256').digest('hex'))
  KEY_HASH=$(printf '%s' "$RAW_KEY" | openssl dgst -sha256 -hex 2>/dev/null | awk '{print $2}')
  if [ -z "$KEY_HASH" ] || [ "${#KEY_HASH}" -ne 64 ]; then
    log_fail "$SERVICE_NAME — SHA-256 hash failed or unexpected length"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS+=("FAIL|$SERVICE_NAME|hash computation failed")
    log ""
    continue
  fi

  # Compute prefix (first 18 chars of raw key, same as UI display)
  KEY_PREFIX="${RAW_KEY:0:18}"

  # Check if already seeded (match on hash + environment + not revoked)
  EXISTING=$(${PSQL_CMD} -tAc \
    "SELECT id FROM public.platform_api_key
     WHERE key_hash = '${KEY_HASH}'
       AND revoked_at IS NULL
     LIMIT 1;" 2>>"$LOGFILE" || true)

  if [ -n "$EXISTING" ]; then
    log_skip "$SERVICE_NAME — already seeded (id: $EXISTING)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    RESULTS+=("SKIP|$SERVICE_NAME|already seeded: $EXISTING")
    log ""
    continue
  fi

  # Not seeded — insert
  if [ "$DRY_RUN" = "true" ]; then
    log_pass "$SERVICE_NAME — would INSERT (dry-run; hash: ${KEY_HASH:0:12}…)"
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS+=("SEEDED(dry)|$SERVICE_NAME|would insert row")
    log ""
    continue
  fi

  INSERT_SQL="
INSERT INTO public.platform_api_key (
  name,
  key_type,
  environment,
  key_hash,
  key_prefix,
  version,
  scopes,
  created_by
) VALUES (
  '${SERVICE_NAME}',
  '${KEY_TYPE}',
  '${ENVIRONMENT}',
  '${KEY_HASH}',
  '${KEY_PREFIX}',
  'current',
  ARRAY[${SCOPES_PG}]::text[],
  '${ADMIN_USER_ID}'
)
ON CONFLICT (key_hash) DO NOTHING
RETURNING id;
"

  INSERTED_ID=$(${PSQL_CMD} -tAc "$INSERT_SQL" 2>>"$LOGFILE" || true)
  if [ -n "$INSERTED_ID" ]; then
    log_pass "$SERVICE_NAME — seeded (id: $INSERTED_ID)"
    PASS_COUNT=$((PASS_COUNT + 1))
    RESULTS+=("SEEDED|$SERVICE_NAME|new row: $INSERTED_ID")
  else
    # ON CONFLICT DO NOTHING returns no row — check if it exists now
    RECHECK=$(${PSQL_CMD} -tAc \
      "SELECT id FROM public.platform_api_key WHERE key_hash = '${KEY_HASH}' LIMIT 1;" 2>>"$LOGFILE" || true)
    if [ -n "$RECHECK" ]; then
      log_skip "$SERVICE_NAME — concurrent insert (id: $RECHECK)"
      SKIP_COUNT=$((SKIP_COUNT + 1))
      RESULTS+=("SKIP|$SERVICE_NAME|concurrent: $RECHECK")
    else
      log_fail "$SERVICE_NAME — INSERT returned no ID and row not found"
      FAIL_COUNT=$((FAIL_COUNT + 1))
      RESULTS+=("FAIL|$SERVICE_NAME|insert silent fail")
    fi
  fi

  log ""
done

# ── Summary ──────────────────────────────────────────────────────────────────
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "SUMMARY"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log ""
printf "%-30s  %s\n" "Service" "Status" | tee -a "$LOGFILE"
printf "%-30s  %s\n" "──────────────────────────────" "──────────────────────" | tee -a "$LOGFILE"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r status name detail <<< "$r"
  printf "%-30s  %s — %s\n" "$name" "$status" "$detail" | tee -a "$LOGFILE"
done
log ""
log "Seeded : $PASS_COUNT"
log "Skipped: $SKIP_COUNT (already present)"
log "Failed : $FAIL_COUNT"
log ""
log "Full log: $LOGFILE"

if [ "$FAIL_COUNT" -gt 0 ]; then
  log_fail "$FAIL_COUNT service key(s) failed to seed. Check log above."
  exit 1
fi

if [ "$DRY_RUN" = "true" ]; then
  log "${YELLOW}DRY-RUN complete — no rows written.${NC}"
  log "Re-run without --dry-run to apply."
fi

exit 0
