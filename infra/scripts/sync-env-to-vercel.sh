#!/usr/bin/env bash
set -euo pipefail
# ============================================
# sync-env-to-vercel.sh — 1Password → Vercel env sync
#
# NUKE-AND-REPLACE: deletes ALL env vars from each project, then re-adds
# from 1Password. This ensures no stale/duplicate entries survive.
#
# ALL Vercel vars read from smartout_ai_prod (production URLs).
# ONLY preview Supabase reads from smartout_ai (Branch DB).
# smartout_ai has LOCALHOST URLs — NEVER use for non-Supabase Vercel vars.
#
# Usage:
#   ./infra/scripts/sync-env-to-vercel.sh              # sync all
#   ./infra/scripts/sync-env-to-vercel.sh --dry-run     # preview what would be set
#   ./infra/scripts/sync-env-to-vercel.sh --project smartout-web
# ============================================

DRY_RUN=false
PROJECT_FILTER=""

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --project) PROJECT_FILTER="__NEXT__" ;;
    *)
      if [[ "$PROJECT_FILTER" == "__NEXT__" ]]; then
        PROJECT_FILTER="$arg"
      fi
      ;;
  esac
done
[[ "$PROJECT_FILTER" == "__NEXT__" ]] && { echo "ERROR: --project requires a value" >&2; exit 1; }

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

# ── Auth ─────────────────────────────────────────────────────

if ! op whoami >/dev/null 2>&1; then
  echo "ERROR: 1Password not signed in. Run: eval \"\$(op signin)\"" >&2
  exit 1
fi
echo "1Password: $(op whoami 2>/dev/null | grep Email | awk '{print $2}')"

VERCEL_TOKEN=""
for auth_path in \
  "$HOME/.local/share/com.vercel.cli/auth.json" \
  "$HOME/.config/vercel/auth.json" \
  "$HOME/.vercel/auth.json"; do
  if [[ -f "$auth_path" ]]; then
    VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$auth_path')).get('token',''))" 2>/dev/null)
    break
  fi
done

if [[ -z "$VERCEL_TOKEN" ]]; then
  echo "ERROR: No Vercel auth token found. Run: vercel login" >&2
  exit 1
fi
echo "Vercel:    authenticated"

# ── Project IDs ──────────────────────────────────────────────

TEAM_ID="team_bbtw5JnNxRkKlecAKQB7qqzG"

get_project_id() {
  curl -sf "https://api.vercel.com/v9/projects/$1?teamId=$TEAM_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null
}

echo ""
echo "Fetching project IDs..."
WEB_PROJECT_ID=$(get_project_id "smartout-web")
LANDING_PROJECT_ID=$(get_project_id "smartout-landing")
echo "  smartout-web:     $WEB_PROJECT_ID"
echo "  smartout-landing: $LANDING_PROJECT_ID"

# ── Vercel API helpers ───────────────────────────────────────

nuke_project_env() {
  local project_id="$1"
  local env_ids
  env_ids=$(curl -sf "https://api.vercel.com/v9/projects/$project_id/env?teamId=$TEAM_ID&limit=100" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    | python3 -c "
import sys, json
[print(e['id']) for e in json.load(sys.stdin).get('envs', [])]
" 2>/dev/null)

  local count=0
  for env_id in $env_ids; do
    curl -sf -X DELETE "https://api.vercel.com/v9/projects/$project_id/env/$env_id?teamId=$TEAM_ID" \
      -H "Authorization: Bearer $VERCEL_TOKEN" >/dev/null 2>&1 || true
    count=$((count + 1))
  done
  echo "  Deleted $count entries"
}

add_env_var() {
  local project_id="$1"
  local key_name="$2"
  local value="$3"
  local env_target="$4"
  local is_sensitive="$5"

  local target_json
  case "$env_target" in
    shared)     target_json='["preview", "production"]' ;;
    preview)    target_json='["preview"]' ;;
    production) target_json='["production"]' ;;
  esac

  local type_val="encrypted"
  [[ "$is_sensitive" == "false" ]] && type_val="plain"

  local payload
  payload=$(python3 -c "
import json, sys
value = sys.stdin.read().strip()
print(json.dumps({
    'key': '$key_name',
    'value': value,
    'target': $target_json,
    'type': '$type_val',
}))
" <<< "$value")

  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "https://api.vercel.com/v10/projects/$project_id/env?teamId=$TEAM_ID" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || http_code="000"

  [[ "$http_code" == "200" || "$http_code" == "201" ]]
}

# ── Manifest ─────────────────────────────────────────────────
# Verified against apps/web/src/env.ts and apps/landing/src/env.ts
#
# VAULT RULE:
#   smartout_ai_prod = ALL Vercel vars (production URLs, prod keys)
#   smartout_ai      = ONLY preview Supabase Branch DB
#
# target: shared = preview+production | preview = Branch DB only | production = prod DB only

MANIFEST=$(cat <<'EOF'
# ══════════════════════════════════════════════════════════════
# smartout-web (apps/web/src/env.ts: 28 server + 10 client)
# ══════════════════════════════════════════════════════════════
# ── Shared (preview + production, from prod vault) ───────────
smartout-web|shared|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai_prod/PostHog/api_key|false
smartout-web|shared|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai_prod/PostHog/host|false
smartout-web|shared|NEXT_PUBLIC_SENTRY_DSN|op://smartout_ai_prod/Sentry/dsn|false
smartout-web|shared|NEXT_PUBLIC_ROOT_DOMAIN|op://smartout_ai_prod/SmartOut/root_domain|false
smartout-web|shared|NEXT_PUBLIC_LANDING_URL|op://smartout_ai_prod/SmartOut/landing_url|false
smartout-web|shared|NEXT_PUBLIC_REVALIDATION_SECRET|op://smartout_ai_prod/SmartOut/revalidation_secret|false
smartout-web|shared|NEXT_PUBLIC_STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|false
smartout-web|shared|NEXT_PUBLIC_LIVEKIT_URL|op://smartout_ai_prod/livekit/wss-url|false
smartout-web|shared|STRIPE_SECRET_KEY|op://smartout_ai_prod/Stripe/secret_key|true
smartout-web|shared|STRIPE_WEBHOOK_SECRET|op://smartout_ai_prod/Stripe/webhook_secret|true
smartout-web|shared|SENDGRID_API_KEY|op://smartout_ai_prod/SendGrid/api_key|true
smartout-web|shared|TWILIO_ACCOUNT_SID|op://smartout_ai_prod/Twilio/account_sid|true
smartout-web|shared|TWILIO_AUTH_TOKEN|op://smartout_ai_prod/Twilio/auth_token|true
smartout-web|shared|JWT_SECRET|op://smartout_ai_prod/SmartOut/jwt_secret|true
smartout-web|shared|SESSION_SECRET|op://smartout_ai_prod/SmartOut/session_secret|true
smartout-web|shared|OPENROUTER_API_KEY|op://smartout_ai_prod/OpenRouter/api_key|true
smartout-web|shared|ULTRAVOX_API_KEY|op://smartout_ai_prod/Ultravox/api_key|true
smartout-web|shared|SENTRY_DSN|op://smartout_ai_prod/Sentry/dsn|true
smartout-web|shared|GITHUB_ERROR_TOKEN|op://smartout_ai_prod/GitHub/error_reporter_token|true
smartout-web|shared|DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai_prod/DocuSeal/webhook_secret|true
smartout-web|shared|UPSTASH_REDIS_REST_URL|op://smartout_ai_prod/Upstash/rest_url|true
smartout-web|shared|UPSTASH_REDIS_REST_TOKEN|op://smartout_ai_prod/Upstash/rest_token|true
smartout-web|shared|CONTRACT_SERVICE_URL|op://smartout_ai_prod/Contract-Service/url|true
smartout-web|shared|CONTRACT_SERVICE_KEY|op://smartout_ai_prod/Contract-Service/api_key|true
smartout-web|shared|SCRAPLING_SERVICE_URL|op://smartout_ai_prod/Scrapling/url|true
smartout-web|shared|SCRAPLING_AUTH_TOKEN|op://smartout_ai_prod/Scrapling/SCRAPLING_AUTH_TOKEN|true
smartout-web|shared|SERPER_API_KEY|op://smartout_ai_prod/Serper/api_key|true
smartout-web|shared|STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|true
smartout-web|shared|STAGE_ENGINE_API_KEY|op://smartout_ai_prod/Stage-Engine/api_key|true
smartout-web|shared|SHIFT_MCP_URL|op://smartout_ai_prod/Shift-MCP/url|true
smartout-web|shared|LIVEKIT_API_KEY|op://smartout_ai_prod/livekit/api-key|true
smartout-web|shared|LIVEKIT_API_SECRET|op://smartout_ai_prod/livekit/api-secret|true
smartout-web|shared|LIVEKIT_WEBHOOK_SECRET|op://smartout_ai_prod/livekit/webhook-secret|true
# ── Supabase — preview (Branch DB from dev vault) ────────────
smartout-web|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase Preview Branch/url|false
smartout-web|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase Preview Branch/anon_key|false
smartout-web|preview|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai/Supabase Preview Branch/service_role_key|true
smartout-web|preview|DATABASE_URL|op://smartout_ai/PostgreSQL preview/connection_string|true
# ── Supabase — production (from prod vault) ──────────────────
smartout-web|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai_prod/Supabase/url|false
smartout-web|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai_prod/Supabase/anon_key|false
smartout-web|production|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai_prod/Supabase/service_role_key|true
smartout-web|production|DATABASE_URL|op://smartout_ai_prod/PostgreSQL/connection_string|true
# ══════════════════════════════════════════════════════════════
# smartout-landing (apps/landing/src/env.ts: 14 server + 6 client)
# ══════════════════════════════════════════════════════════════
# ── Shared (preview + production, from prod vault) ───────────
smartout-landing|shared|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai_prod/PostHog/api_key|false
smartout-landing|shared|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai_prod/PostHog/host|false
smartout-landing|shared|NEXT_PUBLIC_WEB_APP_URL|op://smartout_ai_prod/SmartOut/web_app_url|false
smartout-landing|shared|STRIPE_SECRET_KEY|op://smartout_ai_prod/Stripe/secret_key|true
smartout-landing|shared|STRIPE_WEBHOOK_SECRET|op://smartout_ai_prod/Stripe/webhook_secret|true
smartout-landing|shared|SENDGRID_API_KEY|op://smartout_ai_prod/SendGrid/api_key|true
smartout-landing|shared|TWILIO_ACCOUNT_SID|op://smartout_ai_prod/Twilio/account_sid|true
smartout-landing|shared|TWILIO_AUTH_TOKEN|op://smartout_ai_prod/Twilio/auth_token|true
smartout-landing|shared|JWT_SECRET|op://smartout_ai_prod/SmartOut/jwt_secret|true
smartout-landing|shared|SESSION_SECRET|op://smartout_ai_prod/SmartOut/session_secret|true
smartout-landing|shared|ULTRAVOX_API_KEY|op://smartout_ai_prod/Ultravox/api_key|true
smartout-landing|shared|STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|true
smartout-landing|shared|STAGE_ENGINE_API_KEY|op://smartout_ai_prod/Stage-Engine/api_key|true
smartout-landing|shared|INTERVJU_MCP_WEBHOOK_SECRET|op://smartout_ai_prod/Intervju-MCP/webhook_secret|true
smartout-landing|shared|REVALIDATION_SECRET|op://smartout_ai_prod/SmartOut/revalidation_secret|true
# ── Supabase — preview (Branch DB from dev vault) ────────────
smartout-landing|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase Preview Branch/url|false
smartout-landing|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase Preview Branch/anon_key|false
smartout-landing|preview|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai/Supabase Preview Branch/service_role_key|true
smartout-landing|preview|DATABASE_URL|op://smartout_ai/PostgreSQL preview/connection_string|true
# ── Supabase — production (from prod vault) ──────────────────
smartout-landing|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai_prod/Supabase/url|false
smartout-landing|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai_prod/Supabase/anon_key|false
smartout-landing|production|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai_prod/Supabase/service_role_key|true
smartout-landing|production|DATABASE_URL|op://smartout_ai_prod/PostgreSQL/connection_string|true
EOF
)

# ── Resolve project names to IDs ─────────────────────────────

resolve_project_id() {
  case "$1" in
    smartout-web) echo "$WEB_PROJECT_ID" ;;
    smartout-landing) echo "$LANDING_PROJECT_ID" ;;
    *) echo "" ;;
  esac
}

# ── Filter manifest ──────────────────────────────────────────

FILTERED_MANIFEST=$(echo "$MANIFEST" | grep -v '^#' | grep -v '^$')
if [[ -n "$PROJECT_FILTER" ]]; then
  FILTERED_MANIFEST=$(echo "$FILTERED_MANIFEST" | grep "^${PROJECT_FILTER}|" || true)
  echo ""
  echo "Filtered to: $PROJECT_FILTER"
fi

# ── Determine which projects to nuke ─────────────────────────

declare -A PROJECTS_TO_NUKE
while IFS='|' read -r project_name rest <&3; do
  [[ -z "$project_name" ]] && continue
  PROJECTS_TO_NUKE[$project_name]=1
done 3<<< "$FILTERED_MANIFEST"

# ── Main sync ────────────────────────────────────────────────

echo ""
[[ "$DRY_RUN" == "true" ]] && echo "*** DRY RUN ***" && echo ""

# Step 1: Nuke all env vars from affected projects
echo "=== Nuking old env vars ==="
for project_name in "${!PROJECTS_TO_NUKE[@]}"; do
  pid=$(resolve_project_id "$project_name")
  if [[ -n "$pid" ]]; then
    echo "  $project_name:"
    if [[ "$DRY_RUN" == "false" ]]; then
      nuke_project_env "$pid"
    else
      echo "  (dry run — would delete all)"
    fi
  fi
done

# Step 2: Add all vars fresh from 1Password
echo ""
echo "=== Setting from 1Password ==="
TOTAL=0
OK=0
FAIL=0

while IFS='|' read -r project_name env_name key_name op_ref is_sensitive <&3; do
  [[ -z "$project_name" ]] && continue
  TOTAL=$((TOTAL + 1))

  pid=$(resolve_project_id "$project_name")
  if [[ -z "$pid" ]]; then
    echo "  FAIL [$env_name] $key_name — unknown project"
    FAIL=$((FAIL + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    sens=""
    [[ "$is_sensitive" == "true" ]] && sens=" [sensitive]"
    echo "  DRY  [$env_name] $key_name ← ${op_ref}${sens}"
    continue
  fi

  value=$(op read "$op_ref" 2>/dev/null) || {
    echo "  FAIL [$env_name] $key_name — op read failed"
    FAIL=$((FAIL + 1))
    continue
  }

  if add_env_var "$pid" "$key_name" "$value" "$env_name" "$is_sensitive"; then
    echo "  SET  [$env_name] $key_name"
    OK=$((OK + 1))
  else
    echo "  FAIL [$env_name] $key_name — API error"
    FAIL=$((FAIL + 1))
  fi
done 3<<< "$FILTERED_MANIFEST"

echo ""
echo "=== Done ==="
echo "Total: $TOTAL | Set: $OK | Failed: $FAIL"
if [[ $FAIL -gt 0 ]]; then
  echo "WARNING: $FAIL vars failed. Check output above."
  exit 1
fi
