#!/bin/bash
# ============================================
# preflight-json.sh — Machine-readable preflight
# Called by Claude Code SessionStart hook.
# Outputs JSON with failures for auto-remediation.
# ============================================

set -uo pipefail

ERRORS=()
WARNINGS=()

# ── 1. Critical env vars ──
check_env() {
  local var_name=$1
  local required=${2:-false}
  local value="${!var_name:-}"

  if [ -z "$value" ]; then
    if [ "$required" = "true" ]; then
      ERRORS+=("{\"type\":\"env\",\"var\":\"$var_name\",\"issue\":\"missing, required\"}")
    else
      WARNINGS+=("{\"type\":\"env\",\"var\":\"$var_name\",\"issue\":\"not set\"}")
    fi
  elif [[ "$value" == op://* ]]; then
    ERRORS+=("{\"type\":\"env\",\"var\":\"$var_name\",\"issue\":\"unresolved op:// reference\"}")
  fi
}

check_env "NEXT_PUBLIC_SUPABASE_URL" true
check_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" true
check_env "SUPABASE_SERVICE_ROLE_KEY"
check_env "OPENROUTER_API_KEY"

# ── 2. Supabase connectivity ──
SUPA_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
SUPA_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

if [ -n "$SUPA_URL" ] && [ -n "$SUPA_KEY" ] && [[ "$SUPA_URL" != op://* ]]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $SUPA_KEY" \
    "$SUPA_URL/rest/v1/" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "200" ]; then
    ERRORS+=("{\"type\":\"connectivity\",\"service\":\"supabase-rest\",\"issue\":\"HTTP $HTTP_CODE\",\"url\":\"$SUPA_URL\"}")
  fi

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "apikey: $SUPA_KEY" \
    "$SUPA_URL/auth/v1/settings" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" != "200" ]; then
    ERRORS+=("{\"type\":\"connectivity\",\"service\":\"supabase-auth\",\"issue\":\"HTTP $HTTP_CODE\"}")
  fi
fi

# ── 3. Docker containers ──
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  check_container() {
    local name=$1
    local critical=${2:-false}
    local status
    status=$(docker ps --filter "name=$name" --format "{{.Status}}" 2>/dev/null | head -1)
    if [ -z "$status" ]; then
      if [ "$critical" = "true" ]; then
        ERRORS+=("{\"type\":\"docker\",\"container\":\"$name\",\"issue\":\"not running\"}")
      else
        WARNINGS+=("{\"type\":\"docker\",\"container\":\"$name\",\"issue\":\"not running\"}")
      fi
    fi
  }

  check_container "supabase_db" true
  check_container "supabase_auth" true
  check_container "infra-stage-engine"
  check_container "infra-caddy"
  check_container "infra-n8n"
fi

# ── Output JSON ──
ERROR_JSON=$(printf '%s,' "${ERRORS[@]}" 2>/dev/null | sed 's/,$//')
WARNING_JSON=$(printf '%s,' "${WARNINGS[@]}" 2>/dev/null | sed 's/,$//')

echo "{\"ok\":${#ERRORS[@]},\"errors\":[${ERROR_JSON}],\"warnings\":[${WARNING_JSON}]}"
