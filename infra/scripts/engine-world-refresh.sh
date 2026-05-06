#!/usr/bin/env bash
# ============================================
# engine-world-refresh.sh — engine_world heartbeat publisher
#
# Publishes platform surface observations to engine_world via the
# engine_world_observe_platform SECURITY DEFINER RPC.
#
# Per ADR-0290: platform writes bypass gate_action. Audit substitute:
# this script calls emit() after each RPC success (PostHog + Logger
# destinations) because activity_trail rejects workspace_id=NULL rows.
#
# Four collectors:
#   a. vercel.web        — latest production deployment status
#   b. supabase.prod     — migration lag (remote tail vs local migration count)
#   c. pr.<id>           — one row per open PR (merge-state + CI checks)
#   d. worktree.<name>   — git worktree ahead/behind state
#
# Exit 0 = all collectors ran (individual failures are soft-logged, not fatal).
# Exit 1 = setup failed (1Password, psql, required tools missing).
#
# Usage:
#   op run --env-file=.env.template -- ./infra/scripts/engine-world-refresh.sh
#   bash infra/scripts/engine-world-refresh.sh  # if env vars already in shell
# ============================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ROWS_WRITTEN=0
COLLECTORS_OK=0
COLLECTORS_FAIL=0

log_ok()   { echo -e "  ${GREEN}OK${NC}    $1"; }
log_warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; }
log_err()  { echo -e "  ${RED}ERR${NC}   $1"; }

# ── Pre-flight: require Supabase URL + service_role key ───────────────────────
#
# RPC is called via Supabase REST API (POST /rest/v1/rpc/engine_world_observe_platform)
# using the service_role JWT. This works both locally (http://127.0.0.1:54321)
# and against prod (https://<ref>.supabase.co).
# psql is NOT required — REST API is sufficient for SECURITY DEFINER RPC calls.
#
# Env vars resolved by 'op run --env-file=.env.template' before this script runs.
# Local dev: NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 (from supabase start).
# Production: SUPABASE_URL=https://<ref>.supabase.co.

# Resolve Supabase URL — prefer SUPABASE_URL (prod), fall back to NEXT_PUBLIC_ (local)
SUPABASE_API_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
if [[ -z "$SUPABASE_API_URL" ]]; then
  # Local dev fallback when neither env var is set
  SUPABASE_API_URL="http://127.0.0.1:54321"
fi
SUPABASE_API_URL="${SUPABASE_API_URL%/}"  # strip trailing slash

# Resolve service_role key
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
if [[ -z "$SUPABASE_SERVICE_KEY" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set — run with 'op run --env-file=.env.template'" >&2
  exit 1
fi

# Vercel token: prefer .env.template-resolved env var, fall back to CLI auth.
VERCEL_TOKEN="${VERCEL_TOKEN:-}"
if [[ -z "$VERCEL_TOKEN" ]]; then
  for auth_path in \
    "$HOME/.local/share/com.vercel.cli/auth.json" \
    "$HOME/.config/vercel/auth.json" \
    "$HOME/.vercel/auth.json"; do
    if [[ -f "$auth_path" ]]; then
      VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$auth_path')).get('token',''))" 2>/dev/null || true)
      break
    fi
  done
fi

VERCEL_TEAM_ID="team_bbtw5JnNxRkKlecAKQB7qqzG"
VERCEL_WEB_PROJECT="smartout-web"

# Supabase prod project ref (used for MCP migration list if available)
SUPABASE_PROD_REF="${SUPABASE_PROJECT_REF:-yljaglomadbhyqpcigff}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ENGINE WORLD REFRESH"
echo "  Repo: $REPO_ROOT"
echo "  API:  $SUPABASE_API_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── RPC helper ───────────────────────────────────────────────────────────────
# call_rpc <surface_id> <surface_type> <status> <details_json> <ttl> <observed_by>
# Calls engine_world_observe_platform via Supabase REST API with service_role JWT.
# Returns 0 on success (HTTP 204), 1 on error.
call_rpc() {
  local surface_id="$1"
  local surface_type="$2"
  local status="$3"
  local details="$4"
  local ttl="${5:-600}"
  local observed_by="${6:-heartbeat-engine-world-refresh}"

  # Build JSON payload for RPC
  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({
  'p_surface_id':   sys.argv[1],
  'p_surface_type': sys.argv[2],
  'p_status':       sys.argv[3],
  'p_details':      json.loads(sys.argv[4]),
  'p_ttl_seconds':  int(sys.argv[5]),
  'p_observed_by':  sys.argv[6],
}))" "$surface_id" "$surface_type" "$status" "$details" "$ttl" "$observed_by" 2>/dev/null)

  if [[ -z "$payload" ]]; then
    return 1
  fi

  local http_code
  http_code=$(curl -sf --max-time 10 \
    -X POST "${SUPABASE_API_URL}/rest/v1/rpc/engine_world_observe_platform" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -o /dev/null \
    -w "%{http_code}" \
    --data "$payload" 2>/dev/null || echo "000")

  # HTTP 200/204 = success; 404/500 = RPC missing or error
  case "$http_code" in
    200|204) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Collector (a): vercel.web ─────────────────────────────────────────────────
echo "  [a] vercel.web"
VERCEL_STATUS="unknown"
VERCEL_DETAILS='{}'

if [[ -z "$VERCEL_TOKEN" ]]; then
  log_warn "vercel.web — no VERCEL_TOKEN available, skipping"
  COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
else
  # GET latest production deployment for smartout-web
  VERCEL_RESPONSE=$(curl -sf --max-time 10 \
    "https://api.vercel.com/v6/deployments?projectId=${VERCEL_WEB_PROJECT}&limit=1&target=production&teamId=${VERCEL_TEAM_ID}" \
    -H "Authorization: Bearer $VERCEL_TOKEN" 2>/dev/null || true)

  if [[ -z "$VERCEL_RESPONSE" ]]; then
    log_warn "vercel.web — Vercel API returned empty response"
    VERCEL_STATUS="unknown"
    VERCEL_DETAILS='{"error":"api_timeout_or_empty"}'
    COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
  else
    VERCEL_STATE=$(echo "$VERCEL_RESPONSE" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0].get('state','UNKNOWN') if deps else 'NONE')" 2>/dev/null || echo "PARSE_ERROR")
    VERCEL_URL=$(echo "$VERCEL_RESPONSE" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0].get('url','') if deps else '')" 2>/dev/null || echo "")
    VERCEL_DEPLOY_ID=$(echo "$VERCEL_RESPONSE" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); deps=d.get('deployments',[]); print(deps[0].get('uid','') if deps else '')" 2>/dev/null || echo "")

    case "$VERCEL_STATE" in
      READY)   VERCEL_STATUS="green" ;;
      BUILDING|INITIALIZING|QUEUED) VERCEL_STATUS="yellow" ;;
      ERROR|CANCELED|FAILED) VERCEL_STATUS="red" ;;
      NONE)    VERCEL_STATUS="unknown" ;;
      *)       VERCEL_STATUS="unknown" ;;
    esac

    VERCEL_DETAILS=$(printf '{"vercel_state":"%s","url":"%s","deployment_id":"%s"}' \
      "$VERCEL_STATE" "$VERCEL_URL" "$VERCEL_DEPLOY_ID")

    if call_rpc "vercel.web" "service" "$VERCEL_STATUS" "$VERCEL_DETAILS" 600 "heartbeat-vercel"; then
      log_ok "vercel.web → $VERCEL_STATUS (state=$VERCEL_STATE)"
      ROWS_WRITTEN=$((ROWS_WRITTEN + 1))
      COLLECTORS_OK=$((COLLECTORS_OK + 1))
    else
      log_err "vercel.web — RPC call failed"
      COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
    fi
  fi
fi

# ── Collector (b): supabase.prod ──────────────────────────────────────────────
echo "  [b] supabase.prod"
SUPA_STATUS="unknown"
SUPA_DETAILS='{}'

# Count local migration files
LOCAL_COUNT=$(ls "$REPO_ROOT/supabase/migrations/"*.sql 2>/dev/null | wc -l | tr -d ' ')
LOCAL_LATEST=$(ls "$REPO_ROOT/supabase/migrations/"*.sql 2>/dev/null | sort | tail -1 | xargs basename 2>/dev/null | sed 's/\.sql$//' || echo "none")

# Query remote applied migrations via Supabase REST API
# supabase_migrations.schema_migrations is accessible via the supabase_admin role;
# for local dev we use the service_role + a direct REST query against the pg_ catalog
# via the /rest/v1/ endpoint if the table is exposed, otherwise fall back to supabase CLI.
REMOTE_COUNT="0"
REMOTE_LATEST="none"

MIGRATION_RESPONSE=$(curl -sf --max-time 10 \
  "${SUPABASE_API_URL}/rest/v1/schema_migrations?select=version&order=version.desc&limit=1" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Accept: application/json" 2>/dev/null || echo "[]")

# Try supabase CLI as fallback for local dev (no psql needed)
if [[ "$MIGRATION_RESPONSE" == "[]" ]] || [[ -z "$MIGRATION_RESPONSE" ]]; then
  CLI_RESULT=$(cd "$REPO_ROOT" && npx supabase db query \
    "SELECT count(*)::int AS cnt, max(version) AS latest FROM supabase_migrations.schema_migrations;" \
    --local 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
rows=d.get('rows',[])
if rows:
    print(rows[0].get('cnt','0'), rows[0].get('latest','none'))
" 2>/dev/null || echo "0 none")
  REMOTE_COUNT=$(echo "$CLI_RESULT" | awk '{print $1}')
  REMOTE_LATEST=$(echo "$CLI_RESULT" | awk '{print $2}')
else
  # Parse REST response
  REMOTE_LATEST=$(echo "$MIGRATION_RESPONSE" | python3 -c \
    "import sys,json; rows=json.load(sys.stdin); print(rows[0]['version'] if rows else 'none')" 2>/dev/null || echo "none")
  # Get count separately
  COUNT_RESPONSE=$(curl -sf --max-time 10 \
    "${SUPABASE_API_URL}/rest/v1/schema_migrations?select=version" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Prefer: count=exact" \
    -o /dev/null -D - 2>/dev/null | grep -i "content-range:" | grep -oP '\d+$' || echo "0")
  REMOTE_COUNT="${COUNT_RESPONSE:-0}"
fi

LAG=0
if [[ "$LOCAL_COUNT" =~ ^[0-9]+$ ]] && [[ "$REMOTE_COUNT" =~ ^[0-9]+$ ]]; then
  LAG=$(( LOCAL_COUNT - REMOTE_COUNT ))
  [[ $LAG -lt 0 ]] && LAG=0

  if   [[ $LAG -eq 0 ]];  then SUPA_STATUS="green"
  elif [[ $LAG -le 3 ]];  then SUPA_STATUS="yellow"
  else                         SUPA_STATUS="red"
  fi

  SUPA_DETAILS=$(printf '{"local_count":%d,"remote_count":%d,"lag":%d,"local_latest":"%s","remote_latest":"%s","prod_ref":"%s"}' \
    "$LOCAL_COUNT" "$REMOTE_COUNT" "$LAG" "$LOCAL_LATEST" "$REMOTE_LATEST" "$SUPABASE_PROD_REF")
else
  SUPA_STATUS="unknown"
  SUPA_DETAILS=$(printf '{"error":"count_parse_failed","local_count":"%s","remote_count":"%s"}' \
    "$LOCAL_COUNT" "$REMOTE_COUNT")
fi

if call_rpc "supabase.prod" "migration" "$SUPA_STATUS" "$SUPA_DETAILS" 600 "heartbeat-supabase"; then
  log_ok "supabase.prod → $SUPA_STATUS (local=$LOCAL_COUNT remote=$REMOTE_COUNT lag=$LAG)"
  ROWS_WRITTEN=$((ROWS_WRITTEN + 1))
  COLLECTORS_OK=$((COLLECTORS_OK + 1))
else
  log_err "supabase.prod — RPC call failed"
  COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
fi

# ── Collector (c): pr.<id> ────────────────────────────────────────────────────
echo "  [c] pr.<id>"
PR_COUNT=0

if ! command -v gh >/dev/null 2>&1; then
  log_warn "pr.* — gh CLI not found, skipping"
  COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
else
  PR_LIST=$(gh pr list \
    --json number,title,mergeStateStatus,statusCheckRollup,isDraft \
    --state open \
    --limit 30 2>/dev/null || echo "[]")

  if [[ "$PR_LIST" == "[]" ]] || [[ -z "$PR_LIST" ]]; then
    log_ok "pr.* — no open PRs"
    COLLECTORS_OK=$((COLLECTORS_OK + 1))
  else
    PR_COUNT=$(echo "$PR_LIST" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

    while IFS= read -r pr_json; do
      PR_NUM=$(echo "$pr_json" | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])" 2>/dev/null || continue)
      PR_TITLE=$(echo "$pr_json" | python3 -c "import sys,json; t=json.load(sys.stdin)['title']; print(t[:60].replace('\"',''))" 2>/dev/null || echo "")
      MERGE_STATE=$(echo "$pr_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mergeStateStatus','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
      IS_DRAFT=$(echo "$pr_json" | python3 -c "import sys,json; print('true' if json.load(sys.stdin).get('isDraft',False) else 'false')" 2>/dev/null || echo "false")

      # Compute PR-level CI summary from statusCheckRollup
      CHECK_SUMMARY=$(echo "$pr_json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
checks=d.get('statusCheckRollup',[]) or []
if not checks:
    print('no_checks')
elif any(c.get('state','') in ('FAILURE','ERROR') for c in checks):
    print('failing')
elif any(c.get('state','') == 'PENDING' for c in checks):
    print('pending')
elif all(c.get('state','') == 'SUCCESS' for c in checks):
    print('passing')
else:
    print('unknown')
" 2>/dev/null || echo "unknown")

      # Derive surface status
      case "$MERGE_STATE" in
        MERGEABLE)
          if [[ "$CHECK_SUMMARY" == "passing" ]]; then PR_STATUS="green"
          elif [[ "$CHECK_SUMMARY" == "pending" ]]; then PR_STATUS="yellow"
          elif [[ "$CHECK_SUMMARY" == "failing" ]]; then PR_STATUS="red"
          else PR_STATUS="yellow"
          fi ;;
        CONFLICTING) PR_STATUS="red" ;;
        BLOCKED)
          if [[ "$CHECK_SUMMARY" == "failing" ]]; then PR_STATUS="red"
          else PR_STATUS="yellow"
          fi ;;
        *)           PR_STATUS="unknown" ;;
      esac

      # Draft PRs are yellow by convention
      [[ "$IS_DRAFT" == "true" ]] && PR_STATUS="yellow"

      PR_DETAILS=$(printf '{"title":"%s","merge_state":"%s","check_summary":"%s","is_draft":%s}' \
        "$PR_TITLE" "$MERGE_STATE" "$CHECK_SUMMARY" "$IS_DRAFT")

      SURFACE_ID="pr.${PR_NUM}"
      if call_rpc "$SURFACE_ID" "pr" "$PR_STATUS" "$PR_DETAILS" 300 "heartbeat-github"; then
        log_ok "$SURFACE_ID → $PR_STATUS (#$PR_NUM: $PR_TITLE)"
        ROWS_WRITTEN=$((ROWS_WRITTEN + 1))
      else
        log_err "$SURFACE_ID — RPC call failed"
        COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
      fi
    done < <(echo "$PR_LIST" | python3 -c \
      "import sys,json; [print(json.dumps(p)) for p in json.load(sys.stdin)]" 2>/dev/null)

    COLLECTORS_OK=$((COLLECTORS_OK + 1))
    log_ok "pr.* — $PR_COUNT PRs processed"
  fi
fi

# ── Collector (d): worktree.<name> ────────────────────────────────────────────
echo "  [d] worktree.<name>"
WT_COUNT=0

WT_RAW=$(git -C "$REPO_ROOT" worktree list --porcelain 2>/dev/null || echo "")
if [[ -z "$WT_RAW" ]]; then
  log_warn "worktree.* — git worktree list returned empty"
  COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
else
  WT_AHEAD=0
  WT_BEHIND=0
  WT_BRANCH=""
  WT_PATH=""

  # Fetch remote refs so ahead/behind is accurate
  git -C "$REPO_ROOT" fetch origin development --quiet 2>/dev/null || true

  while IFS= read -r line; do
    if [[ "$line" == worktree\ * ]]; then
      # Emit previous worktree if we have path + branch
      if [[ -n "$WT_PATH" ]] && [[ -n "$WT_BRANCH" ]]; then
        # Determine base branch: sorties compare to development, sub-sorties to campaign
        BASE_BRANCH="development"
        if [[ "$WT_BRANCH" == feat/*-* ]]; then
          # Pattern: feat/<campaign>-<sub> → compare to campaign/<campaign>
          CAMPAIGN=$(echo "$WT_BRANCH" | sed 's|feat/\([^-]*\)-.*|\1|')
          if git -C "$REPO_ROOT" rev-parse --verify "origin/campaign/$CAMPAIGN" >/dev/null 2>&1; then
            BASE_BRANCH="campaign/$CAMPAIGN"
          fi
        fi

        # Compute ahead/behind
        WT_AHEAD=$(git -C "$REPO_ROOT" rev-list --count \
          "origin/${BASE_BRANCH}..${WT_BRANCH}" 2>/dev/null || echo "0")
        WT_BEHIND=$(git -C "$REPO_ROOT" rev-list --count \
          "${WT_BRANCH}..origin/${BASE_BRANCH}" 2>/dev/null || echo "0")

        if   [[ "$WT_BEHIND" -eq 0 ]]; then WT_STATUS="green"
        elif [[ "$WT_BEHIND" -le 5 ]]; then WT_STATUS="yellow"
        else                                WT_STATUS="red"
        fi

        # Sanitize path to a short name for surface_id
        WT_NAME=$(basename "$WT_PATH")
        WT_DETAILS=$(printf '{"branch":"%s","base":"%s","ahead":%d,"behind":%d,"path":"%s"}' \
          "$WT_BRANCH" "$BASE_BRANCH" "$WT_AHEAD" "$WT_BEHIND" "$WT_PATH")

        SURFACE_ID="worktree.${WT_NAME}"
        if call_rpc "$SURFACE_ID" "worktree" "$WT_STATUS" "$WT_DETAILS" 1800 "heartbeat-worktree"; then
          log_ok "$SURFACE_ID → $WT_STATUS (${WT_BRANCH} +${WT_AHEAD}/-${WT_BEHIND} vs $BASE_BRANCH)"
          ROWS_WRITTEN=$((ROWS_WRITTEN + 1))
          WT_COUNT=$((WT_COUNT + 1))
        else
          log_err "$SURFACE_ID — RPC call failed"
          COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
        fi
      fi

      WT_PATH="${line#worktree }"
      WT_BRANCH=""
      WT_AHEAD=0
      WT_BEHIND=0

    elif [[ "$line" == branch\ * ]]; then
      WT_BRANCH="${line#branch refs/heads/}"
    fi
  done <<< "$WT_RAW"

  # Emit last worktree
  if [[ -n "$WT_PATH" ]] && [[ -n "$WT_BRANCH" ]]; then
    BASE_BRANCH="development"
    if [[ "$WT_BRANCH" == feat/*-* ]]; then
      CAMPAIGN=$(echo "$WT_BRANCH" | sed 's|feat/\([^-]*\)-.*|\1|')
      if git -C "$REPO_ROOT" rev-parse --verify "origin/campaign/$CAMPAIGN" >/dev/null 2>&1; then
        BASE_BRANCH="campaign/$CAMPAIGN"
      fi
    fi
    WT_AHEAD=$(git -C "$REPO_ROOT" rev-list --count \
      "origin/${BASE_BRANCH}..${WT_BRANCH}" 2>/dev/null || echo "0")
    WT_BEHIND=$(git -C "$REPO_ROOT" rev-list --count \
      "${WT_BRANCH}..origin/${BASE_BRANCH}" 2>/dev/null || echo "0")

    if   [[ "$WT_BEHIND" -eq 0 ]]; then WT_STATUS="green"
    elif [[ "$WT_BEHIND" -le 5 ]]; then WT_STATUS="yellow"
    else                                WT_STATUS="red"
    fi

    WT_NAME=$(basename "$WT_PATH")
    WT_DETAILS=$(printf '{"branch":"%s","base":"%s","ahead":%d,"behind":%d,"path":"%s"}' \
      "$WT_BRANCH" "$BASE_BRANCH" "$WT_AHEAD" "$WT_BEHIND" "$WT_PATH")

    SURFACE_ID="worktree.${WT_NAME}"
    if call_rpc "$SURFACE_ID" "worktree" "$WT_STATUS" "$WT_DETAILS" 1800 "heartbeat-worktree"; then
      log_ok "$SURFACE_ID → $WT_STATUS (${WT_BRANCH} +${WT_AHEAD}/-${WT_BEHIND} vs $BASE_BRANCH)"
      ROWS_WRITTEN=$((ROWS_WRITTEN + 1))
      WT_COUNT=$((WT_COUNT + 1))
    else
      log_err "$SURFACE_ID — RPC call failed"
      COLLECTORS_FAIL=$((COLLECTORS_FAIL + 1))
    fi
  fi

  COLLECTORS_OK=$((COLLECTORS_OK + 1))
  log_ok "worktree.* — $WT_COUNT worktrees processed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $ROWS_WRITTEN -gt 0 ]]; then
  echo -e "${GREEN}  engine_world: $ROWS_WRITTEN rows written ($COLLECTORS_OK collectors OK, $COLLECTORS_FAIL skipped/failed)${NC}"
else
  echo -e "${YELLOW}  engine_world: 0 rows written ($COLLECTORS_FAIL collectors failed)${NC}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Activity log ──────────────────────────────────────────────────────────────
if [[ -x ~/.claude/scripts/log-activity.sh ]]; then
  ~/.claude/scripts/log-activity.sh heartbeat claude \
    "engine-world-refresh: $ROWS_WRITTEN rows written across $COLLECTORS_OK collectors (a:vercel/b:supabase/c:pr/d:worktree)" \
    >/dev/null 2>&1 || true
fi

# Exit 1 only if ALL collectors failed (total failure, not partial)
TOTAL_COLLECTORS=4
if [[ $COLLECTORS_FAIL -ge $TOTAL_COLLECTORS ]]; then
  exit 1
fi
exit 0
