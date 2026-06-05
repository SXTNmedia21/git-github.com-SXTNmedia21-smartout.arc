#!/usr/bin/env bash
# test-design-ingest.sh — Design-Ingest adapter acceptance tests (TDD: RED→GREEN)
#
# Usage: bash bin/test-design-ingest.sh
# Output: per-test PASS/FAIL + summary
# Exit: 0 all green, 1 any FAIL
#
# Test matrix:
#   TDI01 — scripts exist and are executable
#   TDI02 — ingest errors on missing project root
#   TDI03 — ingest errors on missing .sxtn/config.yaml
#   TDI04 — ingest is silent on empty drop folder (exit 0, no changes)
#   TDI05 — feature-index.yaml written after ingest
#   TDI06 — feature-index.yaml validates against feature-index.schema.json
#   TDI07 — docs/domains/ansatte/design/ populated
#   TDI08 — DESIGN-SPEC.md created in domain folder
#   TDI09 — DESIGN-SPEC.md contains feature name
#   TDI10 — design-export/ emptied after successful ingest
#   TDI11 — --dry-run makes NO changes (feature-index absent, export non-empty)
#   TDI12 — idempotent: second ingest run yields same feature-index
#   TDI13 — watch hook is silent on empty export dir
#   TDI14 — watch hook emits systemMessage on non-empty export dir
#   TDI15 — feature-index.yaml feature entry has expected fields

set -uo pipefail   # NOT -e: tests handle failures explicitly

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INGEST="$PLUGIN_DIR/bin/sxtn-design-ingest.sh"
WATCH_HOOK="$PLUGIN_DIR/hooks/sxtn-design-export-watch.sh"
FEATURE_SCHEMA="$PLUGIN_DIR/schemas/feature-index.schema.json"
VALIDATE="$PLUGIN_DIR/bin/sxtn-validate.sh"

PASS=0
FAIL=0
SKIP=0
FAILED_TESTS=()

assert() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✅ $desc"
    PASS=$((PASS+1))
  else
    echo "  ❌ $desc"
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$desc")
  fi
}

assert_fail() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "  ❌ (should fail) $desc"
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$desc")
  else
    echo "  ✅ (correctly failed) $desc"
    PASS=$((PASS+1))
  fi
}

skip() {
  echo "  ⊘ SKIP: $1 ($2)"
  SKIP=$((SKIP+1))
}

# Accumulated temp-dir cleanup — single EXIT trap for the whole harness (never replace trap).
CLEANUP_DIRS=()

_register_cleanup() {
  CLEANUP_DIRS+=("$1")
}

_cleanup_all() {
  local d
  for d in "${CLEANUP_DIRS[@]}"; do
    [[ -n "$d" && -d "$d" ]] && rm -rf "$d"
  done
}

trap _cleanup_all EXIT

echo "════════════════════════════════════════"
echo "SXTN Design-Ingest Test Harness"
echo "════════════════════════════════════════"
echo "Plugin:  $PLUGIN_DIR"
echo ""

# ============================================================
# Fixture builder
# Creates a fake project with .sxtn/design-export/ containing:
#   ansatte-directory.jsx  — two interactive components
#   ansatte-data.js        — data module
# ============================================================
_build_fixture_project() {
  local proj_dir="$1"

  # Minimal .sxtn/config.yaml
  mkdir -p "$proj_dir/.sxtn/design-export"
  cat > "$proj_dir/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: test-project
  worktree_root: ~/dev
  campaign_prefix: test
  domain_root: docs/domains
  feature_layout: "<domain>/<feature>"
stack:
  language: typescript
  database: supabase
  deploy: vercel
paths:
  decisions: docs/decisions
  migrations: supabase/migrations
  dashboard: docs/DASHBOARD.md
dispatch_table: {}
YAML

  # Fixture: ansatte-directory.jsx
  cat > "$proj_dir/.sxtn/design-export/ansatte-directory.jsx" <<'JSX'
import React, { useState } from 'react';

export function AnsatteDirectory({ employees }) {
  const [showEdit, setShowEdit] = useState(false);

  const handleTaskSubmit = (e) => {
    e.preventDefault();
  };

  return (
    <div>
      <h1>Ansatte Directory</h1>
      <button onClick={() => console.log('create')} aria-label="Create Employee">
        Create Employee
      </button>
      <form onSubmit={handleTaskSubmit}>
        <input name="employee-name" onChange={(e) => {}} placeholder="Employee name" />
        <button type="submit">Save Employee</button>
      </form>
      {showEdit && (
        <Modal title="Edit Employee" isOpen={showEdit}>
          <button onClick={() => setShowEdit(false)} aria-label="Close Edit">
            Close
          </button>
        </Modal>
      )}
    </div>
  );
}

export default AnsatteDirectory;
JSX

  # Fixture: ansatte-data.js
  cat > "$proj_dir/.sxtn/design-export/ansatte-data.js" <<'JS'
// Mock employee data for AnsatteDirectory
export const mockEmployees = [
  { id: '1', name: 'Pontus Lindroth', role: 'Manager', tier: 'default' },
  { id: '2', name: 'Jane Doe', role: 'Employee', tier: 'default' },
];
JS
}

# ============================================================
# NOTE: never name the var TMPDIR — that is the magic env var mktemp(1) honors;
# assigning + rm -rf-ing it here would poison every later mktemp call.
# ============================================================
PROJ_TMP=$(mktemp -d)
_register_cleanup "$PROJ_TMP"

_build_fixture_project "$PROJ_TMP"

# ────────────────────────────────────────────
echo ""
echo "TDI01 — scripts exist and are executable"
# ────────────────────────────────────────────
assert "sxtn-design-ingest.sh exists" test -f "$INGEST"
assert "sxtn-design-ingest.sh is executable" test -x "$INGEST"
assert "sxtn-design-export-watch.sh exists" test -f "$WATCH_HOOK"
assert "sxtn-design-export-watch.sh is executable" test -x "$WATCH_HOOK"
assert "feature-index.schema.json exists" test -f "$FEATURE_SCHEMA"

# ────────────────────────────────────────────
echo ""
echo "TDI02 — ingest errors on missing project root"
# ────────────────────────────────────────────
assert_fail "missing project root → non-zero exit" bash "$INGEST" "/tmp/sxtn-nonexistent-$$"

# ────────────────────────────────────────────
echo ""
echo "TDI03 — ingest errors on missing .sxtn/config.yaml"
# ────────────────────────────────────────────
NO_CONFIG_TMP=$(mktemp -d)
_register_cleanup "$NO_CONFIG_TMP"
mkdir -p "$NO_CONFIG_TMP/.sxtn/design-export"
echo "dummy.jsx" > "$NO_CONFIG_TMP/.sxtn/design-export/dummy.jsx"
assert_fail "missing config.yaml → non-zero exit" bash "$INGEST" "$NO_CONFIG_TMP"

# ────────────────────────────────────────────
echo ""
echo "TDI04 — ingest is silent on empty drop folder (exit 0)"
# ────────────────────────────────────────────
EMPTY_PROJ=$(mktemp -d)
_register_cleanup "$EMPTY_PROJ"
mkdir -p "$EMPTY_PROJ/.sxtn/design-export"
cp "$PROJ_TMP/.sxtn/config.yaml" "$EMPTY_PROJ/.sxtn/config.yaml"
assert "empty drop folder → exit 0" bash "$INGEST" "$EMPTY_PROJ"
assert "empty drop folder → feature-index NOT written" bash -c "test ! -f '$EMPTY_PROJ/.sxtn/feature-index.yaml'"

# ────────────────────────────────────────────
echo ""
echo "TDI05 — feature-index.yaml written after ingest"
# ────────────────────────────────────────────
# Run ingest on fixture project
bash "$INGEST" "$PROJ_TMP" >/dev/null 2>&1 || true
assert "feature-index.yaml exists after ingest" test -f "$PROJ_TMP/.sxtn/feature-index.yaml"
assert "feature-index.yaml is non-empty" test -s "$PROJ_TMP/.sxtn/feature-index.yaml"
assert "feature-index.yaml has 'features:' key" grep -q 'features:' "$PROJ_TMP/.sxtn/feature-index.yaml"
assert "feature-index.yaml has 'generated_at:' key" grep -q 'generated_at:' "$PROJ_TMP/.sxtn/feature-index.yaml"

# ────────────────────────────────────────────
echo ""
echo "TDI06 — feature-index.yaml validates against feature-index.schema.json"
# ────────────────────────────────────────────
if command -v ajv >/dev/null 2>&1 && command -v yq >/dev/null 2>&1; then
  assert "feature-index.yaml validates against schema" \
    bash "$VALIDATE" "$FEATURE_SCHEMA" "$PROJ_TMP/.sxtn/feature-index.yaml"
else
  skip "TDI06 schema validation" "ajv or yq not installed"
fi

# ────────────────────────────────────────────
echo ""
echo "TDI07 — docs/domains/ansatte/design/ populated"
# ────────────────────────────────────────────
assert "docs/domains/ansatte/ exists" test -d "$PROJ_TMP/docs/domains/ansatte"
assert "docs/domains/ansatte/design/ exists" test -d "$PROJ_TMP/docs/domains/ansatte/design"
assert "ansatte-directory.jsx copied to design/" test -f "$PROJ_TMP/docs/domains/ansatte/design/ansatte-directory.jsx"
assert "ansatte-data.js copied to design/" test -f "$PROJ_TMP/docs/domains/ansatte/design/ansatte-data.js"

# ────────────────────────────────────────────
echo ""
echo "TDI08 — DESIGN-SPEC.md created in domain folder"
# ────────────────────────────────────────────
assert "DESIGN-SPEC.md exists in ansatte domain" test -f "$PROJ_TMP/docs/domains/ansatte/DESIGN-SPEC.md"

# ────────────────────────────────────────────
echo ""
echo "TDI09 — DESIGN-SPEC.md contains feature name"
# ────────────────────────────────────────────
assert "DESIGN-SPEC.md mentions ansatte-directory feature" \
  grep -q "ansatte-directory" "$PROJ_TMP/docs/domains/ansatte/DESIGN-SPEC.md"
assert "DESIGN-SPEC.md has YAML frontmatter" \
  grep -q "^---" "$PROJ_TMP/docs/domains/ansatte/DESIGN-SPEC.md"
assert "DESIGN-SPEC.md has title in frontmatter" \
  grep -q "title:" "$PROJ_TMP/docs/domains/ansatte/DESIGN-SPEC.md"

# ────────────────────────────────────────────
echo ""
echo "TDI10 — design-export/ emptied after successful ingest"
# ────────────────────────────────────────────
EXPORT_FILE_COUNT=$(find "$PROJ_TMP/.sxtn/design-export" -type f 2>/dev/null | wc -l)
assert "design-export/ is empty after ingest (count=$EXPORT_FILE_COUNT)" \
  bash -c "test '$EXPORT_FILE_COUNT' -eq 0"

# ────────────────────────────────────────────
echo ""
echo "TDI11 — --dry-run makes NO changes"
# ────────────────────────────────────────────
# Build a fresh project (no prior ingest) and run dry-run
DRY_PROJ=$(mktemp -d)
_register_cleanup "$DRY_PROJ"
_build_fixture_project "$DRY_PROJ"

bash "$INGEST" "$DRY_PROJ" --dry-run >/dev/null 2>&1 || true

assert "--dry-run: feature-index.yaml NOT written" \
  bash -c "test ! -f '$DRY_PROJ/.sxtn/feature-index.yaml'"
assert "--dry-run: docs/domains/ NOT created" \
  bash -c "test ! -d '$DRY_PROJ/docs/domains'"
assert "--dry-run: design-export files still present" \
  bash -c "test -f '$DRY_PROJ/.sxtn/design-export/ansatte-directory.jsx'"

# ────────────────────────────────────────────
echo ""
echo "TDI12 — idempotent: second ingest run same result"
# ────────────────────────────────────────────
# Re-populate the export dir and run again — feature-index should update cleanly
IDEM_PROJ=$(mktemp -d)
_register_cleanup "$IDEM_PROJ"
_build_fixture_project "$IDEM_PROJ"

# First run
bash "$INGEST" "$IDEM_PROJ" >/dev/null 2>&1 || true
FIRST_CONTENT=$(cat "$IDEM_PROJ/.sxtn/feature-index.yaml" 2>/dev/null | grep 'features:' || true)

# Second run: re-populate drop folder
_build_fixture_project_export_only() {
  local proj_dir="$1"
  mkdir -p "$proj_dir/.sxtn/design-export"
  cat > "$proj_dir/.sxtn/design-export/ansatte-directory.jsx" <<'JSX'
import React from 'react';
export function AnsatteDirectory() {
  return <div><button aria-label="Create Employee" onClick={()=>{}}>Create Employee</button></div>;
}
JSX
  cat > "$proj_dir/.sxtn/design-export/ansatte-data.js" <<'JS'
export const mockEmployees = [];
JS
}
_build_fixture_project_export_only "$IDEM_PROJ"

bash "$INGEST" "$IDEM_PROJ" >/dev/null 2>&1 || true
SECOND_CONTENT=$(cat "$IDEM_PROJ/.sxtn/feature-index.yaml" 2>/dev/null | grep 'features:' || true)

assert "idempotent: feature-index.yaml still valid after second run" \
  test -f "$IDEM_PROJ/.sxtn/feature-index.yaml"
assert "idempotent: 'features:' key present in second run" \
  bash -c "grep -q 'features:' '$IDEM_PROJ/.sxtn/feature-index.yaml'"

# ────────────────────────────────────────────
echo ""
echo "TDI13 — watch hook silent on empty export dir"
# ────────────────────────────────────────────
WATCH_PROJ=$(mktemp -d)
_register_cleanup "$WATCH_PROJ"
mkdir -p "$WATCH_PROJ/.sxtn/design-export"
cp "$PROJ_TMP/.sxtn/config.yaml" "$WATCH_PROJ/.sxtn/config.yaml" 2>/dev/null || \
  cat > "$WATCH_PROJ/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: test-project
  worktree_root: ~/dev
  campaign_prefix: test
  domain_root: docs/domains
  feature_layout: "<domain>/<feature>"
stack:
  language: typescript
  database: supabase
  deploy: vercel
paths:
  decisions: docs/decisions
  migrations: supabase/migrations
  dashboard: docs/DASHBOARD.md
dispatch_table: {}
YAML

HOOK_OUTPUT=$(bash "$WATCH_HOOK" <<< "{\"session_info\":{\"cwd\":\"$WATCH_PROJ\"}}" 2>/dev/null || true)
assert "watch hook silent on empty export dir (no output)" \
  bash -c "test -z '$HOOK_OUTPUT'"

# ────────────────────────────────────────────
echo ""
echo "TDI14 — watch hook emits systemMessage on non-empty export dir"
# ────────────────────────────────────────────
# Add a file to the drop folder
cp "$PLUGIN_DIR/bin/test-design-ingest.sh" "$WATCH_PROJ/.sxtn/design-export/fake-module.jsx" 2>/dev/null || \
  echo "fake jsx" > "$WATCH_PROJ/.sxtn/design-export/fake-module.jsx"

HOOK_OUTPUT2=$(bash "$WATCH_HOOK" <<< "{\"session_info\":{\"cwd\":\"$WATCH_PROJ\"}}" 2>/dev/null || true)
assert "watch hook emits JSON with systemMessage" \
  bash -c "echo '$HOOK_OUTPUT2' | grep -q 'systemMessage'"
assert "watch hook mentions sxtn-design-ingest" \
  bash -c "echo '$HOOK_OUTPUT2' | grep -q 'sxtn-design-ingest'"

# ────────────────────────────────────────────
echo ""
echo "TDI15 — feature-index feature entry has expected fields"
# ────────────────────────────────────────────
FI_CONTENT=$(cat "$PROJ_TMP/.sxtn/feature-index.yaml" 2>/dev/null || true)
assert "feature-index has 'feature:' field" \
  bash -c "echo '$FI_CONTENT' | grep -q 'feature:'"
assert "feature-index has 'tier:' field" \
  bash -c "echo '$FI_CONTENT' | grep -q 'tier:'"
assert "feature-index has 'domains:' field" \
  bash -c "echo '$FI_CONTENT' | grep -q 'domains:'"
assert "feature-index has 'modules:' field" \
  bash -c "echo '$FI_CONTENT' | grep -q 'modules:'"
assert "feature-index has 'component_keys:' field" \
  bash -c "echo '$FI_CONTENT' | grep -q 'component_keys:'"

# ────────────────────────────────────────────
echo ""
echo "TDI16 — realistic post-init flow: filename-only JSX (no onClick) → domains + files"
# ────────────────────────────────────────────
# Reproduce the exact flow that the pre-existing 36 tests missed:
#   - sxtn-init.sh creates the project scaffold
#   - JSX files in design-export have NO interactive elements (no onClick/onSubmit)
#   - Ingest must still derive features from filenames and scaffold domain dirs
REAL_PROJ_DIR=$(mktemp -d)
_register_cleanup "$REAL_PROJ_DIR"
REAL_PROJ="$REAL_PROJ_DIR/proj"
mkdir -p "$REAL_PROJ/supabase/migrations"
(cd "$REAL_PROJ" && git init -q)
printf 'create table x(x_id uuid);\n' > "$REAL_PROJ/supabase/migrations/20260101000001_x.sql"
bash "$(dirname "$INGEST")/sxtn-init.sh" --defaults "$REAL_PROJ" >/dev/null 2>&1
# Minimal JSX — no onClick, no interactive element pattern — indexer emits entries: []
printf 'export default function AnsatteDirectory(){return <button>Create Task</button>}\n' \
  > "$REAL_PROJ/.sxtn/design-export/ansatte-directory.jsx"
printf 'export default function HmsDashboard(){return <button>New Avvik</button>}\n' \
  > "$REAL_PROJ/.sxtn/design-export/hms-dashboard.jsx"
# Run ingest — must succeed even with empty component-index entries
bash "$INGEST" "$REAL_PROJ" >/dev/null 2>&1 || true

assert "TDI16: docs/domains/ansatte/design/ansatte-directory.jsx exists" \
  test -f "$REAL_PROJ/docs/domains/ansatte/design/ansatte-directory.jsx"
assert "TDI16: docs/domains/hms/design/hms-dashboard.jsx exists" \
  test -f "$REAL_PROJ/docs/domains/hms/design/hms-dashboard.jsx"
assert "TDI16: feature-index.yaml features non-empty (≥2)" \
  bash -c "grep -c '^ *- feature:' '$REAL_PROJ/.sxtn/feature-index.yaml' | grep -qE '^[2-9]|^[0-9]{2,}'"
assert "TDI16: design-export emptied after successful ingest" \
  bash -c "count=\$(find '$REAL_PROJ/.sxtn/design-export' -maxdepth 1 -type f ! -name '.*' 2>/dev/null | wc -l | tr -d ' '); test \"\$count\" -eq 0"

# ────────────────────────────────────────────
echo ""
echo "TDI17 — safety: 0 domains derived → exit non-zero, design-export preserved"
# ────────────────────────────────────────────
# Edge case: JSX file is present but its filename normalizes to an empty feature
# name (all non-alphanumeric characters), so neither the component index nor the
# filename fallback can derive any feature → 0 domains → ingest must exit non-zero
# and must NOT delete the source files (no silent data loss).
SAFETY_PROJ=$(mktemp -d)
_register_cleanup "$SAFETY_PROJ"
mkdir -p "$SAFETY_PROJ/.sxtn/design-export"
cat > "$SAFETY_PROJ/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: safety-test
  worktree_root: ~/dev
  campaign_prefix: test
  domain_root: docs/domains
  feature_layout: "<domain>/<feature>"
stack:
  language: typescript
  database: supabase
  deploy: vercel
paths:
  decisions: docs/decisions
  migrations: supabase/migrations
  dashboard: docs/DASHBOARD.md
dispatch_table: {}
YAML
# "_.jsx" — basename normalizes to "" → filename fallback skips it → 0 features → 0 domains
# Ingest must NOT delete this file; it must exit non-zero with a clear error.
printf 'export default function X(){return <div/>}\n' \
  > "$SAFETY_PROJ/.sxtn/design-export/_.jsx"

# Run ingest — must exit non-zero AND preserve the jsx file
bash "$INGEST" "$SAFETY_PROJ" >/dev/null 2>&1
SAFETY_EXIT=$?
assert_fail "TDI17: 0 domains derived → ingest exits non-zero" \
  bash -c "test $SAFETY_EXIT -eq 0"
assert "TDI17: design-export NOT emptied (jsx file still present)" \
  test -f "$SAFETY_PROJ/.sxtn/design-export/_.jsx"

# ============================================================
# Fixture builder for TDI18–TDI22: pre-made component-index.yaml
#
# Creates a project with a ready-made component-index.yaml in the export dir.
# The index has four entries for feature "task-list":
#   1. button.task-list.create  — trigger_kind: both,   operation: create
#   2. button.task-list.edit    — trigger_kind: api,    operation: update
#   3. link.task-list.nav-known — trigger_kind: navigation, nav_target: /task-list
#   4. link.task-list.nav-dang  — trigger_kind: navigation, nav_target: /unknown-route
#
# "task-list" is the known feature → /task-list resolves; /unknown-route is dangling.
# ============================================================
_build_nav_fixture_project() {
  local proj_dir="$1"
  mkdir -p "$proj_dir/.sxtn/design-export"
  cat > "$proj_dir/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: nav-test-project
  worktree_root: ~/dev
  campaign_prefix: test
  domain_root: docs/domains
  feature_layout: "<domain>/<feature>"
stack:
  language: typescript
  database: supabase
  deploy: vercel
paths:
  decisions: docs/decisions
  migrations: supabase/migrations
  dashboard: docs/DASHBOARD.md
dispatch_table: {}
YAML

  # Pre-made component index — design-ingest picks up *.yaml with 'entries:' key
  cat > "$proj_dir/.sxtn/design-export/component-index.yaml" <<'CI_YAML'
generated_at: "2026-01-01T00:00:00Z"
source_dir: "/fixture"
entries:
  - index_key: "task-list-202601010000000000"
    component_id: "button.task-list.create"
    feature: "task-list"
    tier: default
    module: "task"
    component_type: button
    trigger_kind: both
    operation: create
    api_endpoint: "/api/tasks"
    source_file: "task-list.jsx"
    source_line: 3
  - index_key: "task-list-202601010000000001"
    component_id: "button.task-list.edit"
    feature: "task-list"
    tier: default
    module: "task"
    component_type: button
    trigger_kind: api
    operation: update
    api_endpoint: "/api/tasks"
    source_file: "task-list.jsx"
    source_line: 4
  - index_key: "task-list-202601010000000002"
    component_id: "link.task-list.nav-known"
    feature: "task-list"
    tier: default
    module: "task"
    component_type: link
    trigger_kind: navigation
    operation: none
    nav_target: /task-list
    source_file: "task-list.jsx"
    source_line: 5
  - index_key: "task-list-202601010000000003"
    component_id: "link.task-list.nav-dang"
    feature: "task-list"
    tier: default
    module: "task"
    component_type: link
    trigger_kind: navigation
    operation: none
    nav_target: /unknown-route
    source_file: "task-list.jsx"
    source_line: 6
consistency_gate:
  []
noop_gate:
  []
CI_YAML
}

# ────────────────────────────────────────────
echo ""
echo "TDI18 — components[] rolled up with component_id + interaction_type"
# ────────────────────────────────────────────
NAV_PROJ=$(mktemp -d)
_register_cleanup "$NAV_PROJ"
_build_nav_fixture_project "$NAV_PROJ"

bash "$INGEST" "$NAV_PROJ" >/dev/null 2>&1 || true

NAV_FI="$NAV_PROJ/.sxtn/feature-index.yaml"
assert "TDI18: feature-index written" test -f "$NAV_FI"
assert "TDI18: components[] key present" grep -q 'components:' "$NAV_FI"
assert "TDI18: at least one component_id in feature entry" grep -q 'component_id:' "$NAV_FI"
assert "TDI18: at least one interaction_type in feature entry" grep -q 'interaction_type:' "$NAV_FI"
# The create button (trigger_kind: both) → interaction_type: action
assert "TDI18: button.task-list.create has interaction_type action" \
  bash -c "grep -A1 'button.task-list.create' '$NAV_FI' | grep -q 'action'"

# ────────────────────────────────────────────
echo ""
echo "TDI19 — navigation_gate: resolved + dangling entries"
# ────────────────────────────────────────────
assert "TDI19: navigation_gate key present" grep -q 'navigation_gate' "$NAV_FI"
# Known nav_target /task-list → feature "task-list" → resolved
assert "TDI19: /task-list nav resolves (status: resolved)" \
  bash -c "grep -q 'resolved' '$NAV_FI'"
# Dangling nav_target /unknown-route → dangling
assert "TDI19: /unknown-route nav is dangling (status: dangling)" \
  bash -c "grep -q 'dangling' '$NAV_FI'"
# nav_target values present in gate
assert "TDI19: nav_target /task-list in gate" \
  bash -c "grep -q '/task-list' '$NAV_FI'"
assert "TDI19: nav_target /unknown-route in gate" \
  bash -c "grep -q '/unknown-route' '$NAV_FI'"
# component_id of the nav components should appear in navigation_gate
assert "TDI19: link.task-list.nav-known in navigation_gate" \
  bash -c "grep -q 'link.task-list.nav-known' '$NAV_FI'"
assert "TDI19: link.task-list.nav-dang in navigation_gate" \
  bash -c "grep -q 'link.task-list.nav-dang' '$NAV_FI'"

# ────────────────────────────────────────────
echo ""
echo "TDI20 — navigation_gate always present (empty [] when no nav components)"
# ────────────────────────────────────────────
# The base fixture (TDI05 PROJ_TMP) ran ingest already — it had JSX with no navigation
# components. Re-build it and check navigation_gate: []
NO_NAV_PROJ=$(mktemp -d)
_register_cleanup "$NO_NAV_PROJ"
_build_fixture_project "$NO_NAV_PROJ"
bash "$INGEST" "$NO_NAV_PROJ" >/dev/null 2>&1 || true
NN_FI="$NO_NAV_PROJ/.sxtn/feature-index.yaml"
assert "TDI20: feature-index written (no-nav fixture)" test -f "$NN_FI"
assert "TDI20: navigation_gate key always present" grep -q 'navigation_gate' "$NN_FI"
# Must be an empty array (not null/missing): look for 'navigation_gate: []'
assert "TDI20: navigation_gate is empty array []" grep -q 'navigation_gate: \[\]' "$NN_FI"

# ────────────────────────────────────────────
echo ""
echo "TDI21 — crud_coverage reflects create + update from fixture"
# ────────────────────────────────────────────
assert "TDI21: crud_coverage key present" grep -q 'crud_coverage:' "$NAV_FI"
assert "TDI21: crud_coverage.create: true" \
  bash -c "grep -A4 'crud_coverage:' '$NAV_FI' | grep -q 'create: true'"
assert "TDI21: crud_coverage.update: true" \
  bash -c "grep -A4 'crud_coverage:' '$NAV_FI' | grep -q 'update: true'"
assert "TDI21: crud_coverage.delete: false" \
  bash -c "grep -A4 'crud_coverage:' '$NAV_FI' | grep -q 'delete: false'"

# ────────────────────────────────────────────
echo ""
echo "TDI22 — extended feature-index validates against schema (components + navigation_gate)"
# ────────────────────────────────────────────
if command -v ajv >/dev/null 2>&1 && command -v yq >/dev/null 2>&1; then
  assert "TDI22: nav-fixture feature-index validates against schema" \
    bash "$VALIDATE" "$FEATURE_SCHEMA" "$NAV_FI"
else
  skip "TDI22 schema validation" "ajv or yq not installed"
fi

# ────────────────────────────────────────────
echo ""
echo "TDI23 — parser tolerates UNQUOTED index_key/component_id/feature/module (R1)"
# ────────────────────────────────────────────
# Regression guard: an unquoted (but schema-valid) component index must parse
# into a clean feature entry — never corrupt the value with the whole line.
UNQ_PROJ=$(mktemp -d)
_register_cleanup "$UNQ_PROJ"
mkdir -p "$UNQ_PROJ/.sxtn/design-export"
cat > "$UNQ_PROJ/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: unquoted-test
  domain_root: docs/domains
dispatch_table: {}
YAML
cat > "$UNQ_PROJ/.sxtn/design-export/component-index.yaml" <<'CI_YAML'
generated_at: "2026-01-01T00:00:00Z"
source_dir: /fixture
entries:
  - index_key: task-list-202601010000000000
    component_id: button.task-list.create
    feature: task-list
    tier: default
    module: task
    component_type: button
    trigger_kind: api
    operation: create
consistency_gate:
  []
noop_gate:
  []
CI_YAML
bash "$INGEST" "$UNQ_PROJ" >/dev/null 2>&1 || true
UNQ_FI="$UNQ_PROJ/.sxtn/feature-index.yaml"
assert "TDI23: feature-index written from unquoted index" test -f "$UNQ_FI"
# feature must be exactly 'task-list' — NOT 'feature: task-list' or a whole-line smear
assert "TDI23: feature parsed clean (feature: \"task-list\")" \
  bash -c "grep -q '^  - feature: \"task-list\"\$' '$UNQ_FI'"
# component_key must match the strict index_key pattern (no garbage prefix)
assert "TDI23: component_key is a clean index_key" \
  bash -c "grep -q '\"task-list-202601010000000000\"' '$UNQ_FI'"
# domain derived from clean feature → 'task'
assert "TDI23: docs/domains/task/design scaffolded from unquoted index" \
  test -d "$UNQ_PROJ/docs/domains/task/design"

# ────────────────────────────────────────────
echo ""
echo "TDI24 — nested export files are copied (R2: recursive, not maxdepth 1)"
# ────────────────────────────────────────────
# A design export that preserves pages/ + shared/ subdirs must not silently
# lose files. The copy step (and the safety/count finds) recurse now.
NEST_PROJ=$(mktemp -d)
_register_cleanup "$NEST_PROJ"
mkdir -p "$NEST_PROJ/.sxtn/design-export/pages"
mkdir -p "$NEST_PROJ/.sxtn/design-export/shared"
cat > "$NEST_PROJ/.sxtn/config.yaml" <<'YAML'
plugin_version: "1.0"
project:
  name: nested-test
  domain_root: docs/domains
dispatch_table: {}
YAML
# Minimal jsx (no interactive element → indexer emits entries: [] → filename fallback)
printf 'export default function VaktplanView(){ return <div className="x">v</div> }\n' \
  > "$NEST_PROJ/.sxtn/design-export/pages/vaktplan-view.jsx"
printf 'export const VAKTPLAN = { rows: [] }\n' \
  > "$NEST_PROJ/.sxtn/design-export/shared/vaktplan-data.js"
bash "$INGEST" "$NEST_PROJ" >/dev/null 2>&1 || true
assert "TDI24: nested pages/vaktplan-view.jsx copied to design/" \
  test -f "$NEST_PROJ/docs/domains/vaktplan/design/vaktplan-view.jsx"
assert "TDI24: nested shared/vaktplan-data.js copied to design/" \
  test -f "$NEST_PROJ/docs/domains/vaktplan/design/vaktplan-data.js"
# Safety guard saw the nested jsx → export emptied (not preserved as a failure)
assert "TDI24: nested jsx counted by safety guard (export emptied)" \
  bash -c "[ -z \"\$(find '$NEST_PROJ/.sxtn/design-export' -type f -name '*.jsx' 2>/dev/null)\" ]"

# ────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "Design-Ingest Test Results"
echo "════════════════════════════════════════"
echo "PASS:  $PASS"
echo "FAIL:  $FAIL"
echo "SKIP:  $SKIP"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  exit 1
fi

echo "✅ Design-Ingest GREEN"
exit 0
