#!/usr/bin/env bash
# audit-ghost-migrations.sh — find recorded-but-DDL-not-applied migrations
#
# READ-ONLY. Compares prod schema_migrations against actual prod schema
# via supabase db diff. For each "drop X" statement in the diff, identifies
# which local migration creates that identifier — that migration is the
# suspected ghost.
#
# Requires:
#   - op signin with prod vault access (smartout_ai_prod, requires
#     `unset OP_SERVICE_ACCOUNT_TOKEN && eval $(op signin --account sxtn)`)
#   - supabase CLI (npx supabase works fine)
#
# Usage:
#   ./scripts/audit-ghost-migrations.sh           # human-readable table
#   ./scripts/audit-ghost-migrations.sh --json    # machine-readable JSON
#
# Output:
#   - Suspected ghost migrations table: timestamp | identifier | migration file
#   - Repair commands for each (migration repair --status reverted + db push)
#   - JSON dump to /tmp/ghost-migrations.json if --json

set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────────
PROJECT_REF="yljaglomadbhyqpcigff"
SCHEMAS="public,payroll,websites,timesheet"
MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"
JSON_OUTPUT=false
VERBOSE=false

# ── args ──────────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --json)    JSON_OUTPUT=true ;;
    --verbose) VERBOSE=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

verbose() { [[ "$VERBOSE" == true ]] && echo "$*" >&2 || true; }

# ── preflight ─────────────────────────────────────────────────────────────────
if ! command -v op &>/dev/null; then
  echo "ERROR: 1Password CLI (op) not found." >&2; exit 2
fi

if ! op account list &>/dev/null 2>&1; then
  echo "ERROR: Not signed in to 1Password. Run:" >&2
  echo "  unset OP_SERVICE_ACCOUNT_TOKEN && eval \$(op signin --account sxtn)" >&2
  exit 2
fi

if ! command -v supabase &>/dev/null && ! command -v npx &>/dev/null; then
  echo "ERROR: supabase CLI not found and npx not available." >&2; exit 2
fi

SUPABASE_CMD="supabase"
if ! command -v supabase &>/dev/null; then
  SUPABASE_CMD="npx supabase"
fi

# ── cleanup orphaned shadow containers ────────────────────────────────────────
verbose "Cleaning up orphaned supabase shadow containers..."
# shellcheck disable=SC2046
docker ps -aq -f "label=com.supabase.cli.project" | xargs -r docker rm -f 2>/dev/null || true

# ── fetch prod password from 1Password ────────────────────────────────────────
verbose "Reading prod DB password from 1Password..."
SUPABASE_DB_PASSWORD=""
if ! SUPABASE_DB_PASSWORD="$(op read "op://smartout_ai_prod/PostgreSQL/password" 2>/dev/null)"; then
  echo "ERROR: Could not read op://smartout_ai_prod/PostgreSQL/password." >&2
  echo "       Ensure prod vault access is available." >&2
  exit 2
fi

if [[ -z "$SUPABASE_DB_PASSWORD" ]]; then
  echo "ERROR: op://smartout_ai_prod/PostgreSQL/password returned empty value." >&2; exit 2
fi

# ── link to prod ──────────────────────────────────────────────────────────────
verbose "Linking to project $PROJECT_REF..."
if ! $SUPABASE_CMD link \
  --project-ref "$PROJECT_REF" \
  --password "$SUPABASE_DB_PASSWORD" 2>/dev/null; then
  echo "ERROR: supabase link failed. Check project ref and password." >&2; exit 2
fi

# ── run db diff ───────────────────────────────────────────────────────────────
verbose "Running supabase db diff --linked (schemas: $SCHEMAS)..."
DIFF_OUTPUT=""
if ! DIFF_OUTPUT="$(
  $SUPABASE_CMD db diff \
    --linked \
    --schema "$SCHEMAS" \
    --password "$SUPABASE_DB_PASSWORD" 2>&1
)"; then
  # db diff exits non-zero when there IS a diff — that's the happy-path detection,
  # so we only fail on empty output with a non-zero exit (true CLI error)
  if [[ -z "$DIFF_OUTPUT" ]]; then
    echo "ERROR: supabase db diff produced no output and failed." >&2; exit 2
  fi
fi

if [[ -z "$DIFF_OUTPUT" ]]; then
  echo "No diff detected. No ghost migrations suspected." >&2
  exit 0
fi

verbose "Diff output captured (${#DIFF_OUTPUT} bytes). Extracting drop statements..."

# ── extract dropped identifiers ───────────────────────────────────────────────
# Matches lines like:
#   drop function if exists public.foo(arg type);
#   drop view if exists public.bar;
#   drop table if exists public.baz;
# Capture the schema-qualified identifier (word after "exists ")
DROPPED_IDENTIFIERS=()
while IFS= read -r line; do
  # normalise to lowercase for matching
  lower_line="${line,,}"
  if [[ "$lower_line" =~ ^drop[[:space:]]+(function|view|table)[[:space:]]+if[[:space:]]+exists[[:space:]]+([a-zA-Z0-9_.]+) ]]; then
    raw_id="${BASH_REMATCH[2]}"
    # strip trailing parentheses (function signatures)
    identifier="${raw_id%%(*}"
    # strip any surrounding double-quotes from quoted identifiers
    identifier="${identifier//\"/}"
    # strip schema prefix for local migration search (we search both with and without)
    bare_name="${identifier##*.}"
    DROPPED_IDENTIFIERS+=("${identifier}|${bare_name}")
  fi
done <<< "$DIFF_OUTPUT"

if [[ "${#DROPPED_IDENTIFIERS[@]}" -eq 0 ]]; then
  echo "Diff is non-empty but no drop statements found." >&2
  echo "Manual review of diff recommended." >&2
  if [[ "$VERBOSE" == true ]]; then echo "--- diff ---" >&2; echo "$DIFF_OUTPUT" >&2; fi
  exit 0
fi

# ── match each dropped identifier to its creating migration ───────────────────
GHOSTS=()  # each entry: "timestamp|identifier|migration_file"

for entry in "${DROPPED_IDENTIFIERS[@]}"; do
  full_id="${entry%%|*}"
  bare_id="${entry##*|}"

  match_file=""
  match_ts=""

  # Search migration files for CREATE ... <identifier>
  # Patterns: CREATE FUNCTION, CREATE OR REPLACE FUNCTION, CREATE VIEW, CREATE TABLE
  # We search for bare_id (without schema prefix) to cover both cases
  grep_pattern="create (or replace )?(function|view|table)[[:space:]]+([a-zA-Z0-9_]+[.])?\"?${bare_id}"
  while IFS= read -r mig_file; do
    if grep -qiE "$grep_pattern" "$mig_file" 2>/dev/null; then
      # Extract timestamp from filename (first 14 digits)
      base="$(basename "$mig_file")"
      ts="${base%%_*}"
      if [[ "$ts" =~ ^[0-9]{14}$ ]]; then
        match_ts="$ts"
        match_file="$mig_file"
        break
      fi
    fi
  done < <(find "$MIGRATIONS_DIR" -name "*.sql" | sort)

  if [[ -n "$match_file" ]]; then
    GHOSTS+=("${match_ts}|${full_id}|${match_file}")
    verbose "Found ghost: $full_id → $match_file"
  else
    verbose "No migration found for dropped identifier: $full_id (manual review needed)"
  fi
done

# ── output ────────────────────────────────────────────────────────────────────
if [[ "${#GHOSTS[@]}" -eq 0 ]]; then
  echo "No ghost migrations identified. Diff present but no local migration matched."
  echo "Manual review of diff recommended."
  if [[ "$VERBOSE" == true ]]; then echo "--- diff ---"; echo "$DIFF_OUTPUT"; fi
  exit 0
fi

echo ""
echo "========================================================================"
echo "  SUSPECTED GHOST MIGRATIONS (recorded in schema_migrations, DDL not applied)"
echo "========================================================================"
printf "%-16s  %-40s  %s\n" "TIMESTAMP" "IDENTIFIER" "MIGRATION FILE"
printf "%-16s  %-40s  %s\n" "----------------" "----------------------------------------" "--------------------"

for ghost in "${GHOSTS[@]}"; do
  ts="${ghost%%|*}"
  rest="${ghost#*|}"
  ident="${rest%%|*}"
  mig="${rest##*|}"
  printf "%-16s  %-40s  %s\n" "$ts" "$ident" "$(basename "$mig")"
done

echo ""
echo "-- Repair commands (run in order, DO NOT run this script -- manual action required) --"
echo ""

# Collect unique timestamps to avoid duplicate repair commands
declare -A seen_ts
for ghost in "${GHOSTS[@]}"; do
  ts="${ghost%%|*}"
  if [[ -z "${seen_ts[$ts]+x}" ]]; then
    seen_ts["$ts"]=1
    echo "  npx supabase migration repair --status reverted $ts --password \"\$SUPABASE_DB_PASSWORD\""
  fi
done

echo ""
echo "  # After all repairs above:"
echo "  npx supabase db push --linked --include-all --password \"\$SUPABASE_DB_PASSWORD\""
echo ""
echo "========================================================================"
echo "  Total suspected ghosts: ${#GHOSTS[@]}"
echo "========================================================================"

# ── JSON output ───────────────────────────────────────────────────────────────
if [[ "$JSON_OUTPUT" == true ]]; then
  JSON_FILE="/tmp/ghost-migrations.json"
  scanned_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  ghost_count="${#GHOSTS[@]}"

  # Build JSON using printf to avoid embedded-quote parsing issues
  printf '{\n' > "$JSON_FILE"
  printf '  "project_ref": "%s",\n' "$PROJECT_REF" >> "$JSON_FILE"
  printf '  "scanned_at": "%s",\n' "$scanned_at" >> "$JSON_FILE"
  printf '  "ghost_count": %s,\n' "$ghost_count" >> "$JSON_FILE"
  printf '  "ghosts": [\n' >> "$JSON_FILE"

  first_json=true
  for ghost in "${GHOSTS[@]}"; do
    ts_j="${ghost%%|*}"
    rest_j="${ghost#*|}"
    ident_j="${rest_j%%|*}"
    mig_j="${rest_j##*|}"
    if [[ "$first_json" == true ]]; then
      first_json=false
    else
      printf '    ,\n' >> "$JSON_FILE"
    fi
    printf '    {\n' >> "$JSON_FILE"
    printf '      "timestamp": "%s",\n' "$ts_j" >> "$JSON_FILE"
    printf '      "identifier": "%s",\n' "$ident_j" >> "$JSON_FILE"
    printf '      "migration_file": "%s",\n' "$mig_j" >> "$JSON_FILE"
    printf '      "repair_command": "npx supabase migration repair --status reverted %s"\n' "$ts_j" >> "$JSON_FILE"
    printf '    }\n' >> "$JSON_FILE"
  done

  printf '  ]\n' >> "$JSON_FILE"
  printf '}\n' >> "$JSON_FILE"

  echo "JSON written to $JSON_FILE"
fi

exit 1
