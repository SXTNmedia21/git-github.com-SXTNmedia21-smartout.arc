#!/usr/bin/env bash
# ============================================================================
# verify-memory-writer.sh
# Manual smoke test for the engine_memory auto-summary writer.
#
# F-MEM-UNBLOCK-A3 Task 5 — verifies the full pipe:
#   1. Creates an agent session via stage-engine POST /agent/chat
#   2. Sends a user message ("husk at jeg liker kaffe svart")
#   3. Abandons the session (triggers writeSessionSummary)
#   4. Queries engine_memory for the summary row
#   5. Asserts the row exists with memory_type='summary' containing user text
#
# Prerequisites:
#   - Local Supabase running  (npx supabase start)
#   - Stage engine running    (pnpm --filter @smartout/stage-engine dev  OR
#                              docker compose -f infra/docker-compose.yml up stage-engine)
#   - docker CLI available    (for psql query via supabase_db container)
#   - jq installed
#
# Usage:
#   chmod +x scripts/verify-memory-writer.sh
#   ./scripts/verify-memory-writer.sh [STAGE_ENGINE_URL]
#
# Default STAGE_ENGINE_URL: http://localhost:5010
# ============================================================================

set -euo pipefail

STAGE_ENGINE="${1:-http://localhost:5010}"
WORKSPACE_ID="${VERIFY_WORKSPACE_ID:-}"
PROFILE_ID="${VERIFY_PROFILE_ID:-}"

# ── colour helpers ──────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
fail() { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }
info() { echo -e "${YELLOW}[INFO]${NC}  $*"; }

# ── resolve workspace + profile from DB if not supplied ────────────────────
if [[ -z "$WORKSPACE_ID" || -z "$PROFILE_ID" ]]; then
  info "VERIFY_WORKSPACE_ID / VERIFY_PROFILE_ID not set — resolving from DB..."

  DB_CONTAINER=$(docker ps -q -f name=supabase_db 2>/dev/null | head -1)
  if [[ -z "$DB_CONTAINER" ]]; then
    fail "supabase_db container not running. Start Supabase first."
  fi

  ROW=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -t -A -c \
    "SELECT p.workspace_id || '|' || p.profile_id
       FROM profile p
       JOIN engine_authority_config eac ON eac.workspace_id = p.workspace_id
      WHERE eac.capability = 'memory' AND eac.level IN ('suggest','confirm','autonomous')
        AND p.is_active = true
      LIMIT 1;" 2>/dev/null)

  if [[ -z "$ROW" ]]; then
    fail "No active profile in a workspace with memory authority. Run the memory authority migration first."
  fi

  WORKSPACE_ID=$(echo "$ROW" | cut -d'|' -f1)
  PROFILE_ID=$(echo "$ROW"  | cut -d'|' -f2)
  ok "Resolved workspace_id=${WORKSPACE_ID} profile_id=${PROFILE_ID}"
fi

# ── step 1: create agent session via chat ──────────────────────────────────
info "Step 1 — POST /agent/chat (first turn, creates session)..."

USER_MESSAGE="husk at jeg liker kaffe svart"

CHAT_RESP=$(curl -s -X POST "${STAGE_ENGINE}/agent/chat" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"${USER_MESSAGE}\",
    \"profile_id\": \"${PROFILE_ID}\",
    \"workspace_id\": \"${WORKSPACE_ID}\",
    \"channel\": \"chat\"
  }")

SESSION_ID=$(echo "$CHAT_RESP" | jq -r '.session_id // empty')

if [[ -z "$SESSION_ID" ]]; then
  echo "Response: $CHAT_RESP"
  fail "Step 1 failed — no session_id in response"
fi
ok "Session created: ${SESSION_ID}"

# ── step 2: abandon session (triggers writeSessionSummary) ─────────────────
info "Step 2 — POST /sessions/${SESSION_ID}/abandon..."

ABANDON_RESP=$(curl -s -X POST "${STAGE_ENGINE}/sessions/${SESSION_ID}/abandon" \
  -H "Content-Type: application/json" \
  -H "x-workspace-id: ${WORKSPACE_ID}")

ABANDON_STATUS=$(echo "$ABANDON_RESP" | jq -r '.status // empty')

if [[ "$ABANDON_STATUS" != "abandoned" ]]; then
  echo "Response: $ABANDON_RESP"
  fail "Step 2 failed — session not abandoned (status=${ABANDON_STATUS})"
fi
ok "Session abandoned"

# ── step 3: query engine_memory ────────────────────────────────────────────
info "Step 3 — querying engine_memory for summary row..."

# Allow up to 3 seconds for the async writeSessionSummary to complete
sleep 1

DB_CONTAINER=$(docker ps -q -f name=supabase_db 2>/dev/null | head -1)
if [[ -z "$DB_CONTAINER" ]]; then
  fail "supabase_db container not running for final verification query"
fi

MEMORY_ROW=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -t -A -c \
  "SELECT id || '|' || memory_type || '|' || content
     FROM engine_memory
    WHERE source_session_id = '${SESSION_ID}'
      AND memory_type = 'summary'
    ORDER BY created_at DESC
    LIMIT 1;" 2>/dev/null | tr -d ' ')

if [[ -z "$MEMORY_ROW" ]]; then
  # Retry once after another second (fire-and-forget may need more time)
  sleep 2
  MEMORY_ROW=$(docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -t -A -c \
    "SELECT id || '|' || memory_type || '|' || content
       FROM engine_memory
      WHERE source_session_id = '${SESSION_ID}'
        AND memory_type = 'summary'
      ORDER BY created_at DESC
      LIMIT 1;" 2>/dev/null | tr -d ' ')
fi

if [[ -z "$MEMORY_ROW" ]]; then
  fail "Step 3 failed — no engine_memory row found for session ${SESSION_ID}"
fi

MEMORY_ID=$(echo "$MEMORY_ROW"   | cut -d'|' -f1)
MEMORY_TYPE=$(echo "$MEMORY_ROW" | cut -d'|' -f2)
MEMORY_CONTENT=$(echo "$MEMORY_ROW" | cut -d'|' -f3-)

ok "engine_memory row: id=${MEMORY_ID} memory_type=${MEMORY_TYPE}"
info "Content preview: ${MEMORY_CONTENT:0:120}"

# ── step 4: assert content contains user message ──────────────────────────
if [[ "$MEMORY_CONTENT" != *"kaffe svart"* ]]; then
  fail "Step 4 failed — content does not contain user message 'kaffe svart'"
fi
ok "Content contains expected user text"

# ── done ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}All assertions passed. engine_memory writer is functional.${NC}"
echo "Session: ${SESSION_ID}"
echo "Memory:  ${MEMORY_ID}"
