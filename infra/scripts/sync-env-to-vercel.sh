#!/usr/bin/env bash
set -euo pipefail
# ============================================
# sync-env-to-vercel.sh — Manifest-driven 1Password → Vercel env sync
#
# Uses Vercel REST API (not CLI) for speed. Each var is one curl call
# instead of spawning a full Node.js process. 84 vars in ~60 seconds.
#
# Usage:
#   ./infra/scripts/sync-env-to-vercel.sh              # sync all
#   ./infra/scripts/sync-env-to-vercel.sh --dry-run     # preview only
#
# Prerequisites:
#   - eval "$(op signin)"
#   - vercel login (for token in ~/.local/share/com.vercel.cli/auth.json)
#
# Connected to: .env.template (op:// references)
# ============================================

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

# ── Auth ─────────────────────────────────────────────────────

# 1Password
if ! op whoami >/dev/null 2>&1; then
  echo "ERROR: 1Password not signed in. Run: eval \"\$(op signin)\"" >&2
  exit 1
fi
echo "1Password: $(op whoami 2>/dev/null | grep Email | awk '{print $2}')"

# Vercel token from CLI auth file
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
# Fetch project IDs from Vercel API (needed for REST calls)

get_project_id() {
  local project_name="$1"
  curl -sf "https://api.vercel.com/v9/projects/$project_name" \
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

# Remove env var by name across all environments
remove_env_var() {
  local project_id="$1"
  local key_name="$2"

  # List existing env vars, find ID by name
  local env_ids
  env_ids=$(curl -sf "https://api.vercel.com/v9/projects/$project_id/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    | python3 -c "
import sys, json
data = json.load(sys.stdin)
for env in data.get('envs', []):
    if env['key'] == '$key_name':
        print(env['id'])
" 2>/dev/null)

  for env_id in $env_ids; do
    curl -sf -X DELETE "https://api.vercel.com/v9/projects/$project_id/env/$env_id" \
      -H "Authorization: Bearer $VERCEL_TOKEN" >/dev/null 2>&1 || true
  done
}

# Add env var with value
add_env_var() {
  local project_id="$1"
  local key_name="$2"
  local value="$3"
  local env_target="$4"  # production, preview, development
  local is_sensitive="$5"

  local target_json
  if [[ "$env_target" == "preview" ]]; then
    target_json='["preview"]'
  elif [[ "$env_target" == "production" ]]; then
    target_json='["production"]'
  else
    target_json='["development"]'
  fi

  local type_val="encrypted"
  [[ "$is_sensitive" == "false" ]] && type_val="plain"

  # Use python to safely JSON-encode the value (handles special chars)
  local payload
  payload=$(python3 -c "
import json
print(json.dumps({
    'key': '$key_name',
    'value': '''$value''',
    'target': $target_json,
    'type': '$type_val',
    'gitBranch': 'development' if '$env_target' == 'preview' else None
}))
" 2>/dev/null)

  # Fallback: use python to build payload safely with actual value piped in
  payload=$(python3 -c "
import json, sys
value = sys.stdin.read().strip()
obj = {
    'key': '$key_name',
    'value': value,
    'target': $target_json,
    'type': '$type_val',
}
if '$env_target' == 'preview':
    obj['gitBranch'] = 'development'
print(json.dumps(obj))
" <<< "$value")

  local http_code
  http_code=$(curl -sf -o /dev/null -w "%{http_code}" \
    -X POST "https://api.vercel.com/v10/projects/$project_id/env" \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null) || http_code="000"

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    return 0
  else
    return 1
  fi
}

# ── Manifest ─────────────────────────────────────────────────
# Format: project_name|environment|key_name|op_reference|is_sensitive

MANIFEST=$(cat <<'EOF'
# ── smartout-web — Preview ───────────────────────────────────
smartout-web|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
smartout-web|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
smartout-web|preview|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
smartout-web|preview|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
smartout-web|preview|NEXT_PUBLIC_SENTRY_DSN|op://smartout_ai/Sentry/dsn|false
smartout-web|preview|NEXT_PUBLIC_ROOT_DOMAIN|op://smartout_ai/SmartOut/root_domain|false
smartout-web|preview|NEXT_PUBLIC_LANDING_URL|op://smartout_ai/SmartOut/landing_url|false
smartout-web|preview|NEXT_PUBLIC_REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|false
smartout-web|preview|NEXT_PUBLIC_STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|false
smartout-web|preview|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai/Supabase/service_role_key|true
smartout-web|preview|DATABASE_URL|op://smartout_ai/PostgreSQL/connection_string|true
smartout-web|preview|JWT_SECRET|op://smartout_ai/SmartOut/jwt_secret|true
smartout-web|preview|SESSION_SECRET|op://smartout_ai/SmartOut/session_secret|true
smartout-web|preview|STRIPE_SECRET_KEY|op://smartout_ai/Stripe/secret_key|true
smartout-web|preview|STRIPE_WEBHOOK_SECRET|op://smartout_ai/Stripe/webhook_secret|true
smartout-web|preview|SENDGRID_API_KEY|op://smartout_ai/SendGrid/api_key|true
smartout-web|preview|TWILIO_ACCOUNT_SID|op://smartout_ai/Twilio/account_sid|true
smartout-web|preview|TWILIO_AUTH_TOKEN|op://smartout_ai/Twilio/auth_token|true
smartout-web|preview|OPENROUTER_API_KEY|op://smartout_ai/OpenRouter/api_key|true
smartout-web|preview|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
smartout-web|preview|SENTRY_DSN|op://smartout_ai/Sentry/dsn|true
smartout-web|preview|DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai/DocuSeal/webhook_secret|true
smartout-web|preview|UPSTASH_REDIS_REST_URL|op://smartout_ai/Upstash/rest_url|true
smartout-web|preview|UPSTASH_REDIS_REST_TOKEN|op://smartout_ai/Upstash/rest_token|true
smartout-web|preview|CONTRACT_SERVICE_URL|op://smartout_ai/Contract-Service/url|true
smartout-web|preview|CONTRACT_SERVICE_KEY|op://smartout_ai/Contract-Service/api_key|true
smartout-web|preview|SCRAPLING_SERVICE_URL|op://smartout_ai/Scrapling/url|true
smartout-web|preview|SCRAPLING_AUTH_TOKEN|op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN|true
smartout-web|preview|SERPER_API_KEY|op://smartout_ai/Serper/api_key|true
smartout-web|preview|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
smartout-web|preview|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
smartout-web|preview|SHIFT_MCP_URL|op://smartout_ai/Shift-MCP/url|true
# ── smartout-web — Production ────────────────────────────────
smartout-web|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai_prod/Supabase/url|false
smartout-web|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai_prod/Supabase/anon_key|false
smartout-web|production|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai_prod/PostHog/api_key|false
smartout-web|production|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai_prod/PostHog/host|false
smartout-web|production|NEXT_PUBLIC_SENTRY_DSN|op://smartout_ai_prod/Sentry/dsn|false
smartout-web|production|NEXT_PUBLIC_ROOT_DOMAIN|op://smartout_ai_prod/SmartOut/root_domain|false
smartout-web|production|NEXT_PUBLIC_LANDING_URL|op://smartout_ai_prod/SmartOut/landing_url|false
smartout-web|production|NEXT_PUBLIC_REVALIDATION_SECRET|op://smartout_ai_prod/SmartOut/revalidation_secret|false
smartout-web|production|NEXT_PUBLIC_STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|false
smartout-web|production|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai_prod/Supabase/service_role_key|true
smartout-web|production|DATABASE_URL|op://smartout_ai_prod/PostgreSQL/connection_string|true
smartout-web|production|JWT_SECRET|op://smartout_ai_prod/SmartOut/jwt_secret|true
smartout-web|production|SESSION_SECRET|op://smartout_ai_prod/SmartOut/session_secret|true
smartout-web|production|STRIPE_SECRET_KEY|op://smartout_ai_prod/Stripe/secret_key|true
smartout-web|production|STRIPE_WEBHOOK_SECRET|op://smartout_ai_prod/Stripe/webhook_secret|true
smartout-web|production|SENDGRID_API_KEY|op://smartout_ai_prod/SendGrid/api_key|true
smartout-web|production|TWILIO_ACCOUNT_SID|op://smartout_ai_prod/Twilio/account_sid|true
smartout-web|production|TWILIO_AUTH_TOKEN|op://smartout_ai_prod/Twilio/auth_token|true
smartout-web|production|OPENROUTER_API_KEY|op://smartout_ai_prod/OpenRouter/api_key|true
smartout-web|production|ULTRAVOX_API_KEY|op://smartout_ai_prod/Ultravox/api_key|true
smartout-web|production|SENTRY_DSN|op://smartout_ai_prod/Sentry/dsn|true
smartout-web|production|DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai_prod/DocuSeal/webhook_secret|true
smartout-web|production|UPSTASH_REDIS_REST_URL|op://smartout_ai_prod/Upstash/rest_url|true
smartout-web|production|UPSTASH_REDIS_REST_TOKEN|op://smartout_ai_prod/Upstash/rest_token|true
smartout-web|production|CONTRACT_SERVICE_URL|op://smartout_ai_prod/Contract-Service/url|true
smartout-web|production|CONTRACT_SERVICE_KEY|op://smartout_ai_prod/Contract-Service/api_key|true
smartout-web|production|SCRAPLING_SERVICE_URL|op://smartout_ai_prod/Scrapling/url|true
smartout-web|production|SCRAPLING_AUTH_TOKEN|op://smartout_ai_prod/Scrapling/SCRAPLING_AUTH_TOKEN|true
smartout-web|production|SERPER_API_KEY|op://smartout_ai_prod/Serper/api_key|true
smartout-web|production|STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|true
smartout-web|production|STAGE_ENGINE_API_KEY|op://smartout_ai_prod/Stage-Engine/api_key|true
smartout-web|production|SHIFT_MCP_URL|op://smartout_ai_prod/Shift-MCP/url|true
# ── smartout-landing — Preview ───────────────────────────────
smartout-landing|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
smartout-landing|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
smartout-landing|preview|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
smartout-landing|preview|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
smartout-landing|preview|NEXT_PUBLIC_WEB_APP_URL|op://smartout_ai/SmartOut/web_app_url|false
smartout-landing|preview|REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|true
smartout-landing|preview|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
smartout-landing|preview|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
smartout-landing|preview|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
smartout-landing|preview|ULTRAVOX_AGENT_ID|op://smartout_ai/Ultravox/agent_id|true
# ── smartout-landing — Production ────────────────────────────
smartout-landing|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai_prod/Supabase/url|false
smartout-landing|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai_prod/Supabase/anon_key|false
smartout-landing|production|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai_prod/PostHog/api_key|false
smartout-landing|production|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai_prod/PostHog/host|false
smartout-landing|production|NEXT_PUBLIC_WEB_APP_URL|op://smartout_ai_prod/SmartOut/web_app_url|false
smartout-landing|production|REVALIDATION_SECRET|op://smartout_ai_prod/SmartOut/revalidation_secret|true
smartout-landing|production|STAGE_ENGINE_URL|op://smartout_ai_prod/Stage-Engine/url|true
smartout-landing|production|STAGE_ENGINE_API_KEY|op://smartout_ai_prod/Stage-Engine/api_key|true
smartout-landing|production|ULTRAVOX_API_KEY|op://smartout_ai_prod/Ultravox/api_key|true
smartout-landing|production|ULTRAVOX_AGENT_ID|op://smartout_ai_prod/Ultravox/agent_id|true
EOF
)

# ── Resolve project names to IDs ─────────────────────────────

resolve_project_id() {
  local name="$1"
  case "$name" in
    smartout-web) echo "$WEB_PROJECT_ID" ;;
    smartout-landing) echo "$LANDING_PROJECT_ID" ;;
    *) echo "" ;;
  esac
}

# ── Main sync loop ───────────────────────────────────────────

echo ""
[[ "$DRY_RUN" == "true" ]] && echo "*** DRY RUN ***" && echo ""

TOTAL=0
OK=0
FAIL=0

# First pass: collect unique keys per project and remove them
echo "=== Removing old values ==="
declare -A REMOVED
while IFS='|' read -r project_name env_name key_name op_ref is_sensitive <&3; do
  [[ -z "$project_name" ]] && continue
  local_key="${project_name}:${key_name}"
  if [[ -z "${REMOVED[$local_key]:-}" ]]; then
    pid=$(resolve_project_id "$project_name")
    if [[ "$DRY_RUN" == "false" && -n "$pid" ]]; then
      remove_env_var "$pid" "$key_name"
    fi
    echo "  RM  $project_name → $key_name"
    REMOVED[$local_key]=1
  fi
done 3<<< "$(echo "$MANIFEST" | grep -v '^#' | grep -v '^$')"

# Second pass: add all vars with fresh values
echo ""
echo "=== Adding from 1Password ==="
while IFS='|' read -r project_name env_name key_name op_ref is_sensitive <&3; do
  [[ -z "$project_name" ]] && continue
  TOTAL=$((TOTAL + 1))

  pid=$(resolve_project_id "$project_name")
  if [[ -z "$pid" ]]; then
    echo "  FAIL [$env_name] $key_name — unknown project $project_name"
    FAIL=$((FAIL + 1))
    continue
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    sens=""
    [[ "$is_sensitive" == "true" ]] && sens=" [sensitive]"
    echo "  DRY  [$env_name] $key_name ← ${op_ref}${sens}"
    continue
  fi

  # Read from 1Password
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
done 3<<< "$(echo "$MANIFEST" | grep -v '^#' | grep -v '^$')"

# ── Summary ──────────────────────────────────────────────────

echo ""
echo "=== Done ==="
echo "Total: $TOTAL | Set: $OK | Failed: $FAIL"
if [[ $FAIL -gt 0 ]]; then
  echo "WARNING: $FAIL vars failed. Check output above."
  exit 1
fi
