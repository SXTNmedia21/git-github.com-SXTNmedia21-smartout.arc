#!/usr/bin/env bash
set -euo pipefail
# ============================================
# sync-env-to-vercel.sh — Manifest-driven env var sync
#
# Resolves op:// references from 1Password and pushes real values
# to Vercel projects. Only touches vars listed in the manifest.
# Never prints secret values. Never wipes unlisted vars.
#
# Usage:
#   ./infra/scripts/sync-env-to-vercel.sh              # sync all
#   ./infra/scripts/sync-env-to-vercel.sh --dry-run     # preview only
#
# Prerequisites:
#   - eval "$(op signin)"
#   - vercel login
#
# Connected to: .env.template (op:// references)
# Connected to: apps/web/src/env.ts (validated vars)
# ============================================

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT_DIR"

# ── Helpers ──────────────────────────────────────────────────

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: Missing required command: $1" >&2
    exit 1
  }
}

ensure_op_session() {
  if ! op whoami >/dev/null 2>&1; then
    echo "1Password is not signed in. Run:" >&2
    echo '  eval "$(op signin)"' >&2
    exit 1
  fi
  echo "  1Password: $(op whoami 2>/dev/null | head -1)"
}

ensure_vercel_session() {
  if ! npx vercel whoami >/dev/null 2>&1; then
    echo "Vercel is not signed in. Run:" >&2
    echo "  vercel login" >&2
    exit 1
  fi
  echo "  Vercel:    $(npx vercel whoami 2>/dev/null)"
}

link_project() {
  local project_dir="$1"
  local project_name="$2"
  echo ""
  echo "Linking $project_name in $project_dir..."
  (cd "$ROOT_DIR/$project_dir" && npx vercel link --yes --project "$project_name" 2>/dev/null)
}

sync_var() {
  local project_dir="$1"
  local env_name="$2"
  local key_name="$3"
  local op_ref="$4"
  local is_sensitive="$5"

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  DRY   [$env_name] $key_name ← $op_ref (sensitive=$is_sensitive)"
    return 0
  fi

  # Remove existing (ignore if not found)
  (cd "$ROOT_DIR/$project_dir" && npx vercel env rm "$key_name" "$env_name" --yes >/dev/null 2>&1) || true

  # Read from 1Password and pipe to Vercel
  if [[ "$is_sensitive" == "true" ]]; then
    (cd "$ROOT_DIR/$project_dir" && op read "$op_ref" | npx vercel env add "$key_name" "$env_name" --sensitive 2>/dev/null)
  else
    (cd "$ROOT_DIR/$project_dir" && op read "$op_ref" | npx vercel env add "$key_name" "$env_name" 2>/dev/null)
  fi

  echo "  SET   [$env_name] $key_name"
}

verify_project() {
  local project_dir="$1"
  local env_name="$2"
  echo ""
  echo "Verifying $project_dir [$env_name]..."
  (cd "$ROOT_DIR/$project_dir" && npx vercel env ls "$env_name" 2>/dev/null) || true
}

# ── Preflight ────────────────────────────────────────────────

echo "=== Smartout Vercel Env Sync ==="
echo ""
require_command op
require_command npx
ensure_op_session
ensure_vercel_session
echo ""
[[ "$DRY_RUN" == "true" ]] && echo "*** DRY RUN — no changes will be made ***" && echo ""

# ── Manifest ─────────────────────────────────────────────────
# Format: project_dir|vercel_project|environment|key_name|op_reference|is_sensitive
#
# Rules:
# - NEXT_PUBLIC_* → is_sensitive=false (client-side, visible in browser)
# - Server secrets → is_sensitive=true
# - Only list vars that each project actually uses
# - Use smartout_ai vault for dev/preview, smartout_ai_prod for production (when created)

MANIFEST=$(cat <<'EOF'
# ── apps/web (smartout-web) — Preview ────────────────────────
# Client-side (public)
apps/web|smartout-web|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
apps/web|smartout-web|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
apps/web|smartout-web|preview|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
apps/web|smartout-web|preview|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
apps/web|smartout-web|preview|NEXT_PUBLIC_SENTRY_DSN|op://smartout_ai/Sentry/dsn|false
apps/web|smartout-web|preview|NEXT_PUBLIC_ROOT_DOMAIN|op://smartout_ai/SmartOut/root_domain|false
apps/web|smartout-web|preview|NEXT_PUBLIC_LANDING_URL|op://smartout_ai/SmartOut/landing_url|false
apps/web|smartout-web|preview|NEXT_PUBLIC_REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|false
apps/web|smartout-web|preview|NEXT_PUBLIC_STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|false
# Server secrets
apps/web|smartout-web|preview|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai/Supabase/service_role_key|true
apps/web|smartout-web|preview|DATABASE_URL|op://smartout_ai/PostgreSQL/connection_string|true
apps/web|smartout-web|preview|JWT_SECRET|op://smartout_ai/SmartOut/jwt_secret|true
apps/web|smartout-web|preview|SESSION_SECRET|op://smartout_ai/SmartOut/session_secret|true
apps/web|smartout-web|preview|STRIPE_SECRET_KEY|op://smartout_ai/Stripe/secret_key|true
apps/web|smartout-web|preview|STRIPE_WEBHOOK_SECRET|op://smartout_ai/Stripe/webhook_secret|true
apps/web|smartout-web|preview|SENDGRID_API_KEY|op://smartout_ai/SendGrid/api_key|true
apps/web|smartout-web|preview|TWILIO_ACCOUNT_SID|op://smartout_ai/Twilio/account_sid|true
apps/web|smartout-web|preview|TWILIO_AUTH_TOKEN|op://smartout_ai/Twilio/auth_token|true
apps/web|smartout-web|preview|OPENROUTER_API_KEY|op://smartout_ai/OpenRouter/api_key|true
apps/web|smartout-web|preview|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
apps/web|smartout-web|preview|SENTRY_DSN|op://smartout_ai/Sentry/dsn|true
apps/web|smartout-web|preview|DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai/DocuSeal/webhook_secret|true
apps/web|smartout-web|preview|UPSTASH_REDIS_REST_URL|op://smartout_ai/Upstash/rest_url|true
apps/web|smartout-web|preview|UPSTASH_REDIS_REST_TOKEN|op://smartout_ai/Upstash/rest_token|true
apps/web|smartout-web|preview|CONTRACT_SERVICE_URL|op://smartout_ai/Contract-Service/url|true
apps/web|smartout-web|preview|CONTRACT_SERVICE_KEY|op://smartout_ai/Contract-Service/api_key|true
apps/web|smartout-web|preview|SCRAPLING_SERVICE_URL|op://smartout_ai/Scrapling/url|true
apps/web|smartout-web|preview|SCRAPLING_AUTH_TOKEN|op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN|true
apps/web|smartout-web|preview|SERPER_API_KEY|op://smartout_ai/Serper/api_key|true
apps/web|smartout-web|preview|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
apps/web|smartout-web|preview|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
apps/web|smartout-web|preview|SHIFT_MCP_URL|op://smartout_ai/Shift-MCP/url|true
# ── apps/web (smartout-web) — Production ─────────────────────
# TODO: When smartout_ai_prod vault is created, duplicate the preview
# block above with op://smartout_ai_prod/ references and production URLs.
# For now, production uses the same vault as preview.
apps/web|smartout-web|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
apps/web|smartout-web|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
apps/web|smartout-web|production|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
apps/web|smartout-web|production|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
apps/web|smartout-web|production|NEXT_PUBLIC_SENTRY_DSN|op://smartout_ai/Sentry/dsn|false
apps/web|smartout-web|production|NEXT_PUBLIC_ROOT_DOMAIN|op://smartout_ai/SmartOut/root_domain|false
apps/web|smartout-web|production|NEXT_PUBLIC_LANDING_URL|op://smartout_ai/SmartOut/landing_url|false
apps/web|smartout-web|production|NEXT_PUBLIC_REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|false
apps/web|smartout-web|production|NEXT_PUBLIC_STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|false
apps/web|smartout-web|production|SUPABASE_SERVICE_ROLE_KEY|op://smartout_ai/Supabase/service_role_key|true
apps/web|smartout-web|production|DATABASE_URL|op://smartout_ai/PostgreSQL/connection_string|true
apps/web|smartout-web|production|JWT_SECRET|op://smartout_ai/SmartOut/jwt_secret|true
apps/web|smartout-web|production|SESSION_SECRET|op://smartout_ai/SmartOut/session_secret|true
apps/web|smartout-web|production|STRIPE_SECRET_KEY|op://smartout_ai/Stripe/secret_key|true
apps/web|smartout-web|production|STRIPE_WEBHOOK_SECRET|op://smartout_ai/Stripe/webhook_secret|true
apps/web|smartout-web|production|SENDGRID_API_KEY|op://smartout_ai/SendGrid/api_key|true
apps/web|smartout-web|production|TWILIO_ACCOUNT_SID|op://smartout_ai/Twilio/account_sid|true
apps/web|smartout-web|production|TWILIO_AUTH_TOKEN|op://smartout_ai/Twilio/auth_token|true
apps/web|smartout-web|production|OPENROUTER_API_KEY|op://smartout_ai/OpenRouter/api_key|true
apps/web|smartout-web|production|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
apps/web|smartout-web|production|SENTRY_DSN|op://smartout_ai/Sentry/dsn|true
apps/web|smartout-web|production|DOCUSEAL_WEBHOOK_SECRET|op://smartout_ai/DocuSeal/webhook_secret|true
apps/web|smartout-web|production|UPSTASH_REDIS_REST_URL|op://smartout_ai/Upstash/rest_url|true
apps/web|smartout-web|production|UPSTASH_REDIS_REST_TOKEN|op://smartout_ai/Upstash/rest_token|true
apps/web|smartout-web|production|CONTRACT_SERVICE_URL|op://smartout_ai/Contract-Service/url|true
apps/web|smartout-web|production|CONTRACT_SERVICE_KEY|op://smartout_ai/Contract-Service/api_key|true
apps/web|smartout-web|production|SCRAPLING_SERVICE_URL|op://smartout_ai/Scrapling/url|true
apps/web|smartout-web|production|SCRAPLING_AUTH_TOKEN|op://smartout_ai/Scrapling/SCRAPLING_AUTH_TOKEN|true
apps/web|smartout-web|production|SERPER_API_KEY|op://smartout_ai/Serper/api_key|true
apps/web|smartout-web|production|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
apps/web|smartout-web|production|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
apps/web|smartout-web|production|SHIFT_MCP_URL|op://smartout_ai/Shift-MCP/url|true
# ── apps/landing (smartout-landing) — Preview ────────────────
apps/landing|smartout-landing|preview|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
apps/landing|smartout-landing|preview|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
apps/landing|smartout-landing|preview|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
apps/landing|smartout-landing|preview|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
apps/landing|smartout-landing|preview|NEXT_PUBLIC_WEB_APP_URL|op://smartout_ai/SmartOut/web_app_url|false
apps/landing|smartout-landing|preview|REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|true
apps/landing|smartout-landing|preview|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
apps/landing|smartout-landing|preview|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
apps/landing|smartout-landing|preview|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
apps/landing|smartout-landing|preview|ULTRAVOX_AGENT_ID|op://smartout_ai/Ultravox/agent_id|true
# ── apps/landing (smartout-landing) — Production ─────────────
apps/landing|smartout-landing|production|NEXT_PUBLIC_SUPABASE_URL|op://smartout_ai/Supabase/url|false
apps/landing|smartout-landing|production|NEXT_PUBLIC_SUPABASE_ANON_KEY|op://smartout_ai/Supabase/anon_key|false
apps/landing|smartout-landing|production|NEXT_PUBLIC_POSTHOG_KEY|op://smartout_ai/PostHog/api_key|false
apps/landing|smartout-landing|production|NEXT_PUBLIC_POSTHOG_HOST|op://smartout_ai/PostHog/host|false
apps/landing|smartout-landing|production|NEXT_PUBLIC_WEB_APP_URL|op://smartout_ai/SmartOut/web_app_url|false
apps/landing|smartout-landing|production|REVALIDATION_SECRET|op://smartout_ai/SmartOut/revalidation_secret|true
apps/landing|smartout-landing|production|STAGE_ENGINE_URL|op://smartout_ai/Stage-Engine/url|true
apps/landing|smartout-landing|production|STAGE_ENGINE_API_KEY|op://smartout_ai/Stage-Engine/api_key|true
apps/landing|smartout-landing|production|ULTRAVOX_API_KEY|op://smartout_ai/Ultravox/api_key|true
apps/landing|smartout-landing|production|ULTRAVOX_AGENT_ID|op://smartout_ai/Ultravox/agent_id|true
EOF
)

# ── Link unique projects ─────────────────────────────────────

echo "=== Linking Vercel projects ==="
echo "$MANIFEST" | grep -v '^#' | grep -v '^$' | while IFS='|' read -r project_dir project_name _ _ _ _; do
  echo "$project_dir|$project_name"
done | sort -u | while IFS='|' read -r project_dir project_name; do
  link_project "$project_dir" "$project_name"
done

# ── Remove managed vars ──────────────────────────────────────

echo ""
echo "=== Removing old values ==="
if [[ "$DRY_RUN" == "false" ]]; then
  echo "$MANIFEST" | grep -v '^#' | grep -v '^$' | while IFS='|' read -r project_dir project_name env_name key_name _ _; do
    echo "  RM    [$env_name] $key_name"
    (cd "$ROOT_DIR/$project_dir" && npx vercel env rm "$key_name" "$env_name" --yes >/dev/null 2>&1) || true
  done
else
  echo "  (skipped in dry run)"
fi

# ── Add fresh values from 1Password ──────────────────────────

echo ""
echo "=== Syncing from 1Password ==="
COUNT=0
ERRORS=0

echo "$MANIFEST" | grep -v '^#' | grep -v '^$' | while IFS='|' read -r project_dir project_name env_name key_name op_ref is_sensitive; do
  if [[ "$DRY_RUN" == "true" ]]; then
    sens_label=""
    [[ "$is_sensitive" == "true" ]] && sens_label=" [sensitive]"
    echo "  DRY   [$env_name] $key_name ← ${op_ref}${sens_label}"
    continue
  fi

  if [[ "$is_sensitive" == "true" ]]; then
    if op read "$op_ref" 2>/dev/null | (cd "$ROOT_DIR/$project_dir" && npx vercel env add "$key_name" "$env_name" --sensitive 2>/dev/null); then
      echo "  SET   [$env_name] $key_name [sensitive]"
    else
      echo "  FAIL  [$env_name] $key_name — check op:// ref: $op_ref"
    fi
  else
    if op read "$op_ref" 2>/dev/null | (cd "$ROOT_DIR/$project_dir" && npx vercel env add "$key_name" "$env_name" 2>/dev/null); then
      echo "  SET   [$env_name] $key_name"
    else
      echo "  FAIL  [$env_name] $key_name — check op:// ref: $op_ref"
    fi
  fi
done

# ── Verify ───────────────────────────────────────────────────

echo ""
echo "=== Verification ==="
echo "$MANIFEST" | grep -v '^#' | grep -v '^$' | while IFS='|' read -r project_dir _ env_name _ _ _; do
  echo "$project_dir|$env_name"
done | sort -u | while IFS='|' read -r project_dir env_name; do
  verify_project "$project_dir" "$env_name"
done

echo ""
echo "=== Sync complete ==="
echo ""
echo "Next steps:"
echo "  1. Push to development to trigger Vercel rebuild"
echo "  2. Check PR for Vercel bot status"
echo "  3. When smartout_ai_prod vault exists, update production op:// refs"
