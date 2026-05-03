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

ENV="${1:-}"

if [ -z "$ENV" ]; then
  echo "ERROR: usage: smoke-probe.sh preview|production" >&2
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
    SUPABASE_REF="${SUPABASE_PREVIEW_REF:-cibmhhgsrdmpnmcikalu}"
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
if curl -fsS --max-time 10 "$WEB/api/health" >/dev/null 2>&1; then
  ok "Vercel web ($WEB/api/health)"
elif curl -fsS --max-time 10 "$WEB" >/dev/null 2>&1; then
  warn "Vercel web ($WEB) — root OK but /api/health missing"
else
  fail "Vercel web ($WEB)"
  FAILED=$((FAILED + 1))
fi

# ── Probe: Vercel landing ───────────────────────────────────
if curl -fsS --max-time 10 "$LANDING" >/dev/null 2>&1; then
  ok "Vercel landing ($LANDING)"
else
  fail "Vercel landing ($LANDING)"
  FAILED=$((FAILED + 1))
fi

# ── Probe: Supabase REST ────────────────────────────────────
if curl -fsS --max-time 10 -H "apikey: ${SUPABASE_ANON_KEY:-}" \
     "https://${SUPABASE_REF}.supabase.co/rest/v1/" >/dev/null 2>&1; then
  ok "Supabase REST ($SUPABASE_REF)"
else
  fail "Supabase REST ($SUPABASE_REF)"
  FAILED=$((FAILED + 1))
fi

# ── Probe: Edge Functions (workspace-api gateway) ───────────
# workspace-api is the canonical entry per ADR-0039. If it answers, EFs are alive.
if [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  EF_URL="https://${SUPABASE_REF}.supabase.co/functions/v1/workspace-api/health"
  if curl -fsS --max-time 10 -H "apikey: $SUPABASE_ANON_KEY" "$EF_URL" >/dev/null 2>&1; then
    ok "Edge Functions (workspace-api/health)"
  else
    warn "Edge Functions — workspace-api/health did not respond (may be auth-gated)"
  fi
else
  warn "Edge Functions — SUPABASE_ANON_KEY not set, skipping probe"
fi

# ── Probe: Droplet (production only) ────────────────────────
if [ "$DROPLET_PROBE" = "true" ]; then
  DROPLET_HOST="${DROPLET_HOST:-root@164.92.176.42}"
  if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new \
       "$DROPLET_HOST" \
       "cd /root/dev/smartout.ai && ./infra/scripts/health-check.sh" >/dev/null 2>&1; then
    ok "Droplet ($DROPLET_HOST)"
  else
    fail "Droplet ($DROPLET_HOST)"
    FAILED=$((FAILED + 1))
  fi
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ smoke green for $ENV${NC}"
  exit 0
else
  echo -e "${RED}❌ smoke RED for $ENV ($FAILED surface(s) failed)${NC}"
  exit 1
fi
