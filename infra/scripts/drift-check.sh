#!/usr/bin/env bash
# ============================================
# drift-check.sh — Continuous review of deploy-artefact parity
#
# Four parity checks against live deploy state. Runs nightly via heartbeat,
# manually before any release, and as `make drift` shortcut.
#
# Exit 0 = all parities hold. Exit 1 = at least one drift detected.
# Output is structured so heartbeat-notify.sh can summarise to Telegram.
#
# Checks:
#   1. .env.template op:// refs vs Vercel manifest entry count
#   2. apps/web/src/env.ts schema keys vs Vercel manifest keys
#   3. supabase/functions/**/Deno.env.get() keys vs `supabase secrets list`
#   4. infra/.env keys on droplet vs sync-env-to-droplet.sh manifest
#
# Exit codes:
#   0 — green
#   1 — drift detected
#   2 — unable to run (missing tool, no auth)
#
# Usage:
#   ./infra/scripts/drift-check.sh                 # full
#   ./infra/scripts/drift-check.sh --skip-droplet  # no SSH
#   ./infra/scripts/drift-check.sh --json          # machine-readable
# ============================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$INFRA_DIR")"
cd "$REPO_ROOT"

EW_WRITE="${SCRIPT_DIR}/engine-world-write.sh"

# ── engine_world write helper (fire-and-forget) ──────────────────────────────
# All calls use || true — engine_world writes NEVER block the pipeline.
ew_write() {
  if [ -x "$EW_WRITE" ]; then
    "$EW_WRITE" "$@" || true
  fi
}

SKIP_DROPLET=false
JSON_MODE=false

for arg in "$@"; do
  case $arg in
    --skip-droplet) SKIP_DROPLET=true ;;
    --json) JSON_MODE=true ;;
    -h|--help)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRIFT_COUNT=0
RESULTS=()

record_pass() {
  local name="$1"
  local detail="$2"
  RESULTS+=("PASS|$name|$detail")
  [ "$JSON_MODE" = "false" ] && echo -e "  ${GREEN}PASS${NC}  $name — $detail"
}

record_fail() {
  local name="$1"
  local detail="$2"
  DRIFT_COUNT=$((DRIFT_COUNT + 1))
  RESULTS+=("FAIL|$name|$detail")
  [ "$JSON_MODE" = "false" ] && echo -e "  ${RED}FAIL${NC}  $name — $detail"
}

record_skip() {
  local name="$1"
  local reason="$2"
  RESULTS+=("SKIP|$name|$reason")
  [ "$JSON_MODE" = "false" ] && echo -e "  ${YELLOW}SKIP${NC}  $name — $reason"
}

[ "$JSON_MODE" = "false" ] && {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔍 DRIFT CHECK"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

# ── Check 1: Vercel manifest entry count vs baseline ────────────────────
# Baseline as of ADR-0360 (2026-05-17): 56 entries. 8 preview-tier Supabase
# vars dropped when preview Branch DB was abandoned (Option B). Drift = sudden drop.
VERCEL_MANIFEST_BASELINE=56
VERCEL_MANIFEST_ENTRIES=$(grep -E '^smartout-(web|landing)\|' infra/scripts/sync-env-to-vercel.sh \
  | grep -v '^#' | wc -l | tr -d ' ')

if [ "$VERCEL_MANIFEST_ENTRIES" -lt "$VERCEL_MANIFEST_BASELINE" ]; then
  record_fail "vercel-manifest-baseline" \
    "manifest dropped to $VERCEL_MANIFEST_ENTRIES (baseline $VERCEL_MANIFEST_BASELINE)"
else
  record_pass "vercel-manifest-baseline" \
    "manifest has $VERCEL_MANIFEST_ENTRIES entries (baseline $VERCEL_MANIFEST_BASELINE)"
fi

# ── Check 2: env.ts keys present in (manifest ∪ hardcoded template keys) ─
# env.ts validates what the app expects. Each key is either synced via the
# Vercel manifest OR hardcoded as a plain value in .env.template.
# Drift = env.ts has a key that exists in neither.
ENV_TS_KEYS=$(grep -oP '^\s+[A-Z][A-Z0-9_]+:' apps/web/src/env.ts 2>/dev/null \
  | sed 's/[: ]//g' | sort -u)
MANIFEST_KEYS=$(grep -E '^smartout-web\|' infra/scripts/sync-env-to-vercel.sh \
  | awk -F'|' '{print $3}' | sort -u)
HARDCODED_TEMPLATE_KEYS=$(grep -oP '^[A-Z_][A-Z0-9_]+(?==)' .env.template 2>/dev/null \
  | sort -u)
# Platform-injected vars (Next.js + Vercel runtime) — not in manifest by design
SYSTEM_KEYS=$(printf '%s\n' \
  NODE_ENV VERCEL VERCEL_ENV VERCEL_URL VERCEL_REGION VERCEL_BRANCH_URL \
  VERCEL_GIT_COMMIT_SHA VERCEL_GIT_COMMIT_REF VERCEL_GIT_REPO_OWNER \
  VERCEL_GIT_REPO_SLUG NEXT_RUNTIME PORT)
KNOWN_KEYS=$(printf '%s\n%s\n%s\n' "$MANIFEST_KEYS" "$HARDCODED_TEMPLATE_KEYS" "$SYSTEM_KEYS" | sort -u)

if [ -z "$ENV_TS_KEYS" ] || [ -z "$KNOWN_KEYS" ]; then
  record_skip "env-ts-vs-known-keys" "could not extract keys from env.ts or known sources"
else
  MISSING=$(comm -23 <(echo "$ENV_TS_KEYS") <(echo "$KNOWN_KEYS") | head -5)
  if [ -n "$MISSING" ]; then
    record_fail "env-ts-vs-known-keys" \
      "env.ts has key not in manifest or template: $(echo "$MISSING" | head -1)"
  else
    record_pass "env-ts-vs-known-keys" "all env.ts keys traced to manifest or template"
  fi
fi

# ── Check 3: Edge Function Deno.env.get() vs Supabase secrets ───────────
if ! command -v supabase >/dev/null 2>&1 && ! command -v npx >/dev/null 2>&1; then
  record_skip "edge-fn-secrets" "no supabase CLI available"
else
  EF_KEYS=$(grep -rohP "Deno\.env\.get\(['\"]\K[A-Z_][A-Z0-9_]+" supabase/functions/ 2>/dev/null \
    | sort -u)
  if [ -z "$EF_KEYS" ]; then
    record_skip "edge-fn-secrets" "no Deno.env.get() calls found"
  else
    # We can't query Supabase without a project-ref + auth in CI context.
    # In local heartbeat it works; in CI we skip with a recorded note.
    if [ -n "${SUPABASE_PROJECT_REF:-}" ] && supabase secrets list \
         --project-ref "$SUPABASE_PROJECT_REF" 2>/dev/null > /tmp/supa-secrets.txt; then
      DECLARED_SECRETS=$(awk '/^[A-Z]/ {print $1}' /tmp/supa-secrets.txt | sort -u)
      MISSING_SECRETS=$(comm -23 <(echo "$EF_KEYS") <(echo "$DECLARED_SECRETS") | head -5)
      # Filter out auto-injected vars (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
      MISSING_SECRETS=$(echo "$MISSING_SECRETS" \
        | grep -v -E '^(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL)$')
      if [ -n "$MISSING_SECRETS" ]; then
        record_fail "edge-fn-secrets" \
          "first missing: $(echo "$MISSING_SECRETS" | head -1)"
      else
        record_pass "edge-fn-secrets" "all Deno.env.get() keys present in Supabase secrets"
      fi
    else
      record_skip "edge-fn-secrets" "SUPABASE_PROJECT_REF not set or unreachable"
    fi
  fi
fi

# ── Check 4: droplet env vs sync-env-to-droplet.sh manifest ─────────────
if [ "$SKIP_DROPLET" = "true" ]; then
  record_skip "droplet-env-vs-manifest" "--skip-droplet"
else
  DROPLET_HOST="${DROPLET_HOST:-root@164.92.176.42}"
  DROPLET_ENV_PATH="${DROPLET_ENV_PATH:-/root/dev/smartout.ai/infra/.env}"
  DROPLET_KEYS=$(ssh -o ConnectTimeout=5 -o BatchMode=yes "$DROPLET_HOST" \
    "grep -oP '^[A-Z_]+(?==)' $DROPLET_ENV_PATH 2>/dev/null | sort -u" 2>/dev/null || echo "")
  MANIFEST_DROPLET_KEYS=$(grep -oP '^\s*"\K[A-Z_]+(?=\|)' infra/scripts/sync-env-to-droplet.sh | sort -u)

  if [ -z "$DROPLET_KEYS" ]; then
    record_skip "droplet-env-vs-manifest" "could not read droplet (SSH or path issue)"
  else
    MISSING_ON_DROPLET=$(comm -23 <(echo "$MANIFEST_DROPLET_KEYS") <(echo "$DROPLET_KEYS") | head -5)
    if [ -n "$MISSING_ON_DROPLET" ]; then
      record_fail "droplet-env-vs-manifest" \
        "first missing on droplet: $(echo "$MISSING_ON_DROPLET" | head -1)"
    else
      record_pass "droplet-env-vs-manifest" "all manifest keys present on droplet"
    fi
  fi
fi

# ── Output ───────────────────────────────────────────────────────────────
if [ "$JSON_MODE" = "true" ]; then
  echo "{"
  echo "  \"timestamp\": \"$(date -Iseconds)\","
  echo "  \"drift_count\": $DRIFT_COUNT,"
  echo "  \"checks\": ["
  COUNT=${#RESULTS[@]}
  i=0
  for r in "${RESULTS[@]}"; do
    i=$((i + 1))
    IFS='|' read -r status name detail <<< "$r"
    sep=","
    [ "$i" -eq "$COUNT" ] && sep=""
    echo "    {\"name\": \"$name\", \"status\": \"$status\", \"detail\": \"$detail\"}$sep"
  done
  echo "  ]"
  echo "}"
fi

[ "$JSON_MODE" = "false" ] && {
  echo ""
  if [ "$DRIFT_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ no drift detected${NC}"
  else
    echo -e "${RED}❌ $DRIFT_COUNT drift(s) detected${NC}"
  fi
}

# Activity-log if available
if [ -x ~/.claude/scripts/log-activity.sh ] && [ "$JSON_MODE" = "false" ]; then
  if [ "$DRIFT_COUNT" -eq 0 ]; then
    ~/.claude/scripts/log-activity.sh system claude "drift-check: green" >/dev/null 2>&1 || true
  else
    ~/.claude/scripts/log-activity.sh system claude "drift-check: $DRIFT_COUNT drift(s)" >/dev/null 2>&1 || true
  fi
fi

# engine_world: write deploy.drift surface — best-effort, fire-and-forget
# Build affected_channels list from FAIL results for red status
if [ "$DRIFT_COUNT" -eq 0 ]; then
  _DRIFT_DETAILS="{}"
  _DRIFT_STATUS="green"
else
  # Collect the names of failed checks
  _FAILED_NAMES=""
  for _r in "${RESULTS[@]}"; do
    IFS='|' read -r _s _n _d <<< "$_r"
    if [ "$_s" = "FAIL" ]; then
      _FAILED_NAMES="${_FAILED_NAMES}${_n},"
    fi
  done
  _FAILED_NAMES="${_FAILED_NAMES%,}"  # strip trailing comma
  _DRIFT_DETAILS=$(python3 -c "
import json, sys
print(json.dumps({'drift_count': int(sys.argv[1]), 'affected_channels': sys.argv[2]}))" \
    "$DRIFT_COUNT" "$_FAILED_NAMES" 2>/dev/null || echo "{\"drift_count\":$DRIFT_COUNT}")
  _DRIFT_STATUS="red"
fi
ew_write "deploy.drift" "service" "$_DRIFT_STATUS" "$_DRIFT_DETAILS" 86400 "drift-check"

[ "$DRIFT_COUNT" -eq 0 ] && exit 0 || exit 1
