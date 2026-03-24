#!/bin/bash
# ============================================
# preflight.sh — Pre-dev startup health check
# Runs automatically before `next dev`.
# Checks: env vars, Supabase, Docker services.
# ============================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS="${GREEN}PASS${NC}"
FAIL="${RED}FAIL${NC}"
WARN="${YELLOW}WARN${NC}"
ERRORS=0

echo ""
echo -e "${BOLD}${CYAN}--- Smartout Preflight Check ---${NC}"
echo ""

# ── 1. Critical env vars ──
echo -e "${BOLD}Environment Variables${NC}"

check_env() {
  local var_name=$1
  local required=${2:-false}
  local value="${!var_name:-}"

  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      echo -e "  $var_name: ${FAIL} (missing, required)"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "  $var_name: ${WARN} (not set)"
    fi
  elif [[ "$value" == op://* ]]; then
    echo -e "  $var_name: ${FAIL} (unresolved op:// reference — run with 'op run')"
    ERRORS=$((ERRORS + 1))
  else
    echo -e "  $var_name: ${PASS}"
  fi
}

# Critical (app won't work without these)
check_env "NEXT_PUBLIC_SUPABASE_URL" true
check_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" true

# Important (some features won't work)
check_env "SUPABASE_SERVICE_ROLE_KEY"
check_env "OPENROUTER_API_KEY"
check_env "NEXT_PUBLIC_POSTHOG_KEY"
check_env "SENTRY_DSN"
check_env "STRIPE_SECRET_KEY"
check_env "SENDGRID_API_KEY"

echo ""

# ── 2. Supabase connectivity ──
echo -e "${BOLD}Supabase${NC}"

SUPA_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
SUPA_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

if [ -n "$SUPA_URL" ] && [ -n "$SUPA_KEY" ] && [[ "$SUPA_URL" != op://* ]]; then
  # REST API
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $SUPA_KEY" \
    "$SUPA_URL/rest/v1/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  REST API: ${PASS} ($SUPA_URL)"
  else
    echo -e "  REST API: ${FAIL} (HTTP $HTTP_CODE)"
    ERRORS=$((ERRORS + 1))
  fi

  # Auth
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $SUPA_KEY" \
    "$SUPA_URL/auth/v1/settings" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  Auth API: ${PASS}"
  else
    echo -e "  Auth API: ${FAIL} (HTTP $HTTP_CODE)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo -e "  Connectivity: ${WARN} (skipped — env vars not set)"
fi

echo ""

# ── 3. Docker services (optional) ──
echo -e "${BOLD}Docker Services${NC}"

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  check_docker() {
    local name=$1
    local status
    status=$(docker ps --filter "name=$name" --format "{{.Status}}" 2>/dev/null | head -1)
    if [ -z "$status" ]; then
      echo -e "  $name: ${WARN} (not running)"
    elif [[ "$status" == *"healthy"* ]]; then
      echo -e "  $name: ${PASS} ($status)"
    elif [[ "$status" == *"Up"* ]]; then
      echo -e "  $name: ${PASS} ($status)"
    else
      echo -e "  $name: ${WARN} ($status)"
    fi
  }

  check_docker "supabase_db"
  check_docker "supabase_auth"
  check_docker "infra-stage-engine"
  check_docker "infra-caddy"
  check_docker "infra-n8n"
else
  echo -e "  Docker: ${WARN} (not available)"
fi

echo ""

# ── Summary ──
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}${BOLD}$ERRORS critical issue(s) found.${NC} Fix before continuing."
  echo -e "Hint: Run with ${CYAN}op run --env-file=.env.template -- pnpm --filter web dev${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}All checks passed.${NC} Starting dev server..."
  echo ""
fi
