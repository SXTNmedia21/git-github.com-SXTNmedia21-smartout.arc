#!/usr/bin/env bash
# migration-lint.sh — Static checks on supabase/migrations/ added in this PR.
#
# Catches three classes of bug per `smartout-database-guide` skill + the
# 2026-05-06 supabase migration audit:
#
#   1. New migration timestamp must be strictly greater than the existing
#      repo tip (L-0042).
#   2. `CREATE TABLE IF NOT EXISTS` is forbidden in new migrations — masks
#      ordering bugs. Use proper migration ordering instead.
#   3. `CREATE TYPE name AS ENUM` must use a name not already present in
#      packages/supabase/src/database.types.ts (enum collision check).
#
# Allowed `IF NOT EXISTS` forms (idempotent infrastructure):
#   - CREATE EXTENSION IF NOT EXISTS
#   - CREATE SCHEMA IF NOT EXISTS
#   - CREATE INDEX IF NOT EXISTS  (idempotent, safe to re-apply)
#   - DO $$ BEGIN IF NOT EXISTS ... CREATE TYPE ... END $$  (Postgres-native
#     enum-create-if-needed; only acceptable form for conditional CREATE TYPE)
#
# Inputs (env): GIT_BASE_REF (default: origin/development)
# Exit: 0 if all new migrations clean, 1 if any violation.

set -euo pipefail

log() { echo "[migration-lint] $*" >&2; }
fail() { echo "❌ $*" >&2; FAIL=1; }
ok() { echo "✅ $*" >&2; }

GIT_BASE_REF="${GIT_BASE_REF:-origin/development}"
MIGRATIONS_DIR="supabase/migrations"
TYPES_FILE="packages/supabase/src/database.types.ts"
FAIL=0

# ---------------------------------------------------------------------------
# 1. Find new migration files (added since base ref)
# ---------------------------------------------------------------------------
NEW_MIGRATIONS=$(git diff --name-only --diff-filter=A "$GIT_BASE_REF...HEAD" -- "$MIGRATIONS_DIR/*.sql" 2>/dev/null || true)

if [[ -z "$NEW_MIGRATIONS" ]]; then
  log "No new migrations in this diff. Exiting clean."
  exit 0
fi

log "New migrations to check:"
echo "$NEW_MIGRATIONS" | sed 's/^/  /' >&2

# ---------------------------------------------------------------------------
# 2. Timestamp ordering — every new file must be > base-ref tip
# ---------------------------------------------------------------------------
log "Check 1/3 — timestamp ordering"
BASE_TIP=$(git ls-tree -r --name-only "$GIT_BASE_REF" -- "$MIGRATIONS_DIR" 2>/dev/null \
  | grep -E "^${MIGRATIONS_DIR}/[0-9]{14}_" \
  | sort \
  | tail -1 \
  | sed 's|.*/||' \
  | cut -c1-14)

if [[ -z "$BASE_TIP" ]]; then
  log "Could not determine base-ref migration tip — skipping ordering check"
else
  log "Base-ref tip: $BASE_TIP"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    BASENAME=$(basename "$f")
    [[ ! "$BASENAME" =~ ^[0-9]{14}_ ]] && continue
    TS="${BASENAME:0:14}"
    # Numeric compare: timestamps are 14-digit YYYYMMDDHHMMSS, safe as numbers.
    if (( 10#$TS <= 10#$BASE_TIP )); then
      fail "Migration $f timestamp ($TS) is not strictly greater than base tip ($BASE_TIP). Re-timestamp the file. (L-0042)"
    fi
  done <<< "$NEW_MIGRATIONS"
fi

# ---------------------------------------------------------------------------
# 3. CREATE TABLE IF NOT EXISTS forbidden
# ---------------------------------------------------------------------------
log "Check 2/3 — CREATE TABLE IF NOT EXISTS forbidden"
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  HITS=$(grep -nE -i "CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS" "$f" 2>/dev/null || true)
  if [[ -n "$HITS" ]]; then
    fail "Forbidden CREATE TABLE IF NOT EXISTS in $f:"
    echo "$HITS" | sed 's/^/    /' >&2
    echo "  → Either remove the IF NOT EXISTS, or fix the underlying ordering issue." >&2
  fi
done <<< "$NEW_MIGRATIONS"

# ---------------------------------------------------------------------------
# 4. ENUM collision check against database.types.ts
# ---------------------------------------------------------------------------
log "Check 3/3 — ENUM name collisions vs database.types.ts"
if [[ ! -f "$TYPES_FILE" ]]; then
  log "Types file $TYPES_FILE missing — skipping enum check"
else
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    # Extract `CREATE TYPE name AS ENUM` (skip CREATE TYPE in DO blocks for now;
    # those are intentional idempotence checks)
    NEW_ENUMS=$(grep -oP "CREATE\s+TYPE\s+\K[a-z_][a-z0-9_]*(?=\s+AS\s+ENUM)" "$f" 2>/dev/null || true)
    while IFS= read -r enum_name; do
      [[ -z "$enum_name" ]] && continue
      # Look for the enum as a typed key in database.types.ts:
      #   `enum_name: "value1" | "value2"` patterns appear under `Enums:` section
      if grep -qE "^\s+${enum_name}:\s*\"" "$TYPES_FILE"; then
        fail "Enum '$enum_name' in $f already exists in $TYPES_FILE. Pick a different name."
      fi
    done <<< "$NEW_ENUMS"
  done <<< "$NEW_MIGRATIONS"
fi

# ---------------------------------------------------------------------------
# Result
# ---------------------------------------------------------------------------
echo "" >&2
if [[ "$FAIL" -ne 0 ]]; then
  fail "Migration lint failed. See errors above."
  exit 1
fi
ok "All new migrations passed lint checks."
exit 0
