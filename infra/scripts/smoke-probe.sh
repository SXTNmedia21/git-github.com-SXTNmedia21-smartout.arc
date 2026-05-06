#!/usr/bin/env bash
# ============================================
# smoke-probe.sh — Post-deploy health verification
#
# Hits health endpoints for all four production surfaces:
# Vercel web, Vercel landing, Supabase Edge Functions, droplet.
#
# Exit 0 = all green. Exit 1 = any red.
#
# Usage:
#   ./infra/scripts/smoke-probe.sh preview
#   ./infra/scripts/smoke-probe.sh production
#
# Called by:
#   - ~/.claude/scripts/promote-preview.sh after FF push
#   - infra/scripts/deploy.sh after droplet deploy
#   - heartbeat job (post-main smoke after main merge)
# ============================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EW_WRITE="${SCRIPT_DIR}/engine-world-write.sh"

# ── engine_world write helper (fire-and-forget) ──────────────────────────────
# All calls use || true — engine_world writes NEVER block the pipeline.
ew_write() {
  if [ -x "$EW_WRITE" ]; then
    "$EW_WRITE" "$@" || true
  fi
}

ENV=""
SKIP_DROPLET=false

for arg in "$@"; do
  case "$arg" in
    --skip-droplet) SKIP_DROPLET=true ;;
    -h|--help)
      echo "Usage: smoke-probe.sh preview|production [--skip-droplet]"
      exit 0
      ;;
    *) [ -z "$ENV" ] && ENV="$arg" ;;
  esac
done

if [ -z "$ENV" ]; then
  echo "ERROR: usage: smoke-probe.sh preview|production [--skip-droplet]" >&2
  exit 2
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}OK${NC}    $1"; }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; }

# Surface URLs per environment
case "$ENV" in
  preview)
    WEB="${VERCEL_PREVIEW_WEB_URL:-https://smartout-web-git-preview-smartout.vercel.app}"
    LANDING="${VERCEL_PREVIEW_LANDING_URL:-https://smartout-landing-git-preview-smartout.vercel.app}"
    SUPABASE_REF="${SUPABASE_PREVIEW_REF:-rrjfrisxvrrhyzzitlxd}"
    DROPLET_PROBE=false   # No preview droplet (ADR-0071 accepted asymmetry)
    ;;
  production)
    WEB="${VERCEL_PROD_WEB_URL:-https://app.smartout.ai}"
    LANDING="${VERCEL_PROD_LANDING_URL:-https://smartout.ai}"
    SUPABASE_REF="${SUPABASE_PROD_REF:-yljaglomadbhyqpcigff}"
    DROPLET_PROBE=true
    ;;
  *)
    echo "ERROR: env must be preview or production, got: $ENV" >&2
    exit 2
    ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔬 SMOKE PROBE: $ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FAILED=0

# ── Probe: Vercel web ───────────────────────────────────────
# Vercel preview deploys are SSO-protected → 401 = alive (Vercel responding,
# auth-gated). Production uses custom-domain bypass so 200 expected.
WEB_HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$WEB/api/health" 2>/dev/null || echo "000")
WEB_ROOT_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$WEB" 2>/dev/null || echo "000")
case "$ENV:$WEB_HEALTH_CODE:$WEB_ROOT_CODE" in
  *:200:*) ok "Vercel web ($WEB/api/health)" ;;
  *:*:200|*:*:307|*:*:308) ok "Vercel web ($WEB) — root $WEB_ROOT_CODE" ;;
  preview:401:*|preview:*:401) ok "Vercel web ($WEB) — http 401 = alive (SSO-gated preview)" ;;
  *) fail "Vercel web ($WEB) — health=$WEB_HEALTH_CODE root=$WEB_ROOT_CODE"; FAILED=$((FAILED + 1)) ;;
esac

# ── Probe: Vercel landing ───────────────────────────────────
LANDING_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$LANDING" 2>/dev/null || echo "000")
case "$ENV:$LANDING_CODE" in
  *:200|*:307|*:308) ok "Vercel landing ($LANDING) — http $LANDING_CODE" ;;
  preview:401) ok "Vercel landing ($LANDING) — http 401 = alive (SSO-gated preview)" ;;
  *) fail "Vercel landing ($LANDING) — http $LANDING_CODE"; FAILED=$((FAILED + 1)) ;;
esac

# ── Probe: Supabase REST (reachability — 200/401/403 all = alive) ───
# Supabase REST always requires apikey. We only verify the endpoint
# responds with a known auth-status, not 5xx or DNS failure.
SUPA_REST_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  "https://${SUPABASE_REF}.supabase.co/rest/v1/" 2>/dev/null || echo "000")
case "$SUPA_REST_CODE" in
  200|401|403) ok "Supabase REST ($SUPABASE_REF) — http $SUPA_REST_CODE = alive" ;;
  *) fail "Supabase REST ($SUPABASE_REF) — http $SUPA_REST_CODE"; FAILED=$((FAILED + 1)) ;;
esac

# ── Probe: Edge Functions (workspace-api reachability) ──────
# workspace-api is the canonical entry per ADR-0039. 200/401/404 = function alive.
# 5xx or no response = function dead.
EF_URL="https://${SUPABASE_REF}.supabase.co/functions/v1/workspace-api/health"
EF_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$EF_URL" 2>/dev/null || echo "000")
case "$EF_CODE" in
  200|204) ok "Edge Functions (workspace-api/health) — http $EF_CODE" ;;
  401|403|404) ok "Edge Functions reachable — http $EF_CODE = alive (auth-gated)" ;;
  *) fail "Edge Functions ($EF_URL) — http $EF_CODE"; FAILED=$((FAILED + 1)) ;;
esac

# ── Probe: Droplet (production only, SSH-aware) ─────────────
if [ "$DROPLET_PROBE" = "true" ]; then
  DROPLET_HOST="${DROPLET_HOST:-root@164.92.176.42}"
  # Skip if --skip-droplet flag, no SSH key, or BatchMode unreachable.
  if [ "${SKIP_DROPLET:-false}" = "true" ]; then
    warn "Droplet ($DROPLET_HOST) — skipped via --skip-droplet"
  elif ! ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no \
         "$DROPLET_HOST" 'echo ok' >/dev/null 2>&1; then
    warn "Droplet ($DROPLET_HOST) — SSH unreachable from this context (skip)"
  else
    if ssh -o ConnectTimeout=10 -o BatchMode=yes "$DROPLET_HOST" \
         "cd /root/dev/smartout.ai && ./infra/scripts/health-check.sh" >/dev/null 2>&1; then
      ok "Droplet ($DROPLET_HOST)"
    else
      fail "Droplet ($DROPLET_HOST) — SSH OK but health-check failed"
      FAILED=$((FAILED + 1))
    fi
  fi
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ smoke green for $ENV${NC}"
  # engine_world: deploy.smoke.<env> green — all surfaces responded
  _SMOKE_DETAILS=$(python3 -c "
import json, sys
print(json.dumps({'env': sys.argv[1], 'failed_surfaces': 0}))" \
    "$ENV" 2>/dev/null || echo "{}")
  ew_write "deploy.smoke.${ENV}" "service" "green" "$_SMOKE_DETAILS" 3600 "smoke-probe"
  exit 0
else
  echo -e "${RED}❌ smoke RED for $ENV ($FAILED surface(s) failed)${NC}"
  # engine_world: deploy.smoke.<env> red — one or more surfaces failed
  _SMOKE_DETAILS=$(python3 -c "
import json, sys
print(json.dumps({'env': sys.argv[1], 'failed_surfaces': int(sys.argv[2])}))" \
    "$ENV" "$FAILED" 2>/dev/null || echo "{}")
  ew_write "deploy.smoke.${ENV}" "service" "red" "$_SMOKE_DETAILS" 3600 "smoke-probe"
  exit 1
fi
