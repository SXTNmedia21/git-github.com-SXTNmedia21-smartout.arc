#!/usr/bin/env bash
# emit-coverage.sh — Layer-2 telemetry gate: checks whether required events
# are (1) defined in registry.ts and (2) actually called via emit() in UI code.
#
# Usage: emit-coverage.sh <domain> <app_subdir>
#   domain       — e.g. vaktplan (maps to .sxtn-staging/telemetry-map/<domain>/control.json)
#   app_subdir   — relative path from repo root, e.g. apps/web/src/app/dashboard/schedule
#
# Outputs:
#   .sxtn-staging/telemetry-map/reports/emit-coverage-<domain>.json
#   Human summary to stdout
#
# Exit codes:
#   0  — all required events emitted
#   1  — usage error
#   2  — one or more required events NOT emitted (honest gap, not a script error)

set -uo pipefail

# ─── Args ───────────────────────────────────────────────────────────────────
DOMAIN="${1:-}"
APP_SUBDIR="${2:-}"

if [[ -z "$DOMAIN" || -z "$APP_SUBDIR" ]]; then
  echo "Usage: emit-coverage.sh <domain> <app_subdir>" >&2
  echo "  e.g.: emit-coverage.sh vaktplan apps/web/src/app/dashboard/schedule" >&2
  exit 1
fi

# ─── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STAGING_DIR="$SCRIPT_DIR"
REPORTS_DIR="$STAGING_DIR/reports"
CONTROL_JSON="$STAGING_DIR/$DOMAIN/control.json"
REGISTRY_TS="$REPO_ROOT/packages/telemetry/src/registry.ts"
APP_DIR="$REPO_ROOT/$APP_SUBDIR"
TELEMETRY_MAP="$STAGING_DIR/$DOMAIN/TELEMETRY-MAP.md"
OUTPUT_JSON="$REPORTS_DIR/emit-coverage-${DOMAIN}.json"

# ─── Validation ─────────────────────────────────────────────────────────────
if [[ ! -f "$CONTROL_JSON" ]]; then
  echo "ERROR: control.json not found at $CONTROL_JSON" >&2
  echo "  Available domains: $(ls "$STAGING_DIR" | grep -v '\.' | tr '\n' ' ')" >&2
  exit 1
fi

if [[ ! -f "$REGISTRY_TS" ]]; then
  echo "ERROR: registry.ts not found at $REGISTRY_TS" >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  echo "ERROR: app subdir not found at $APP_DIR" >&2
  exit 1
fi

mkdir -p "$REPORTS_DIR"

# ─── Extract required events via Python ─────────────────────────────────────
# Strategy:
#   1. From control.json: read events_missing_from_registry — filter to real keys only
#      (pattern: dot-separated identifiers, no spaces/parens).
#   2. From TELEMETRY-MAP.md (if present): extract all backtick-quoted event keys
#      (both dotted and "word word" formats used in emit() calls).
#   3. Union of both sets = required event list.
#
# For each event key:
#   - defined_in_registry: check if the literal string appears in registry.ts
#   - emitted_in_ui: grep app_subdir for   event: "<key>"   in .ts/.tsx files
#   - emit_site: first file:line match (relative to app_subdir)

python3 - <<PYEOF
import json, re, subprocess, sys, os

domain = "$DOMAIN"
control_json_path = "$CONTROL_JSON"
registry_ts_path = "$REGISTRY_TS"
app_dir = "$APP_DIR"
app_subdir = "$APP_SUBDIR"
telemetry_map_path = "$TELEMETRY_MAP"
output_path = "$OUTPUT_JSON"

# ── Load control.json ────────────────────────────────────────────────────────
with open(control_json_path) as f:
    ctrl = json.load(f)

# ── Pattern for "real" event keys (no spaces, no parens, dot-separated identifiers)
real_key_pattern = re.compile(r'^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$')

# ── Collect required events ──────────────────────────────────────────────────
required_events = set()

# Source A: events_missing_from_registry (filter to real keys only)
missing = ctrl.get("events_missing_from_registry", [])
for entry in missing:
    entry = entry.strip()
    if real_key_pattern.match(entry):
        required_events.add(entry)

# Source B: TELEMETRY-MAP.md (if present) — backtick-quoted tokens
if os.path.isfile(telemetry_map_path):
    with open(telemetry_map_path) as f:
        md_text = f.read()
    all_bt = re.findall(r'\`([^\`]+)\`', md_text)
    for bt in all_bt:
        bt = bt.strip()
        # Dotted notation (e.g. schedule.week_navigated)
        if real_key_pattern.match(bt):
            required_events.add(bt)
        # Two-word "verb object" pattern used in legacy emit calls (e.g. "shift created")
        elif re.match(r'^[a-z][a-z0-9_]+ [a-z][a-z0-9_]+$', bt):
            required_events.add(bt)

required_list = sorted(required_events)

# ── Load registry.ts content once ────────────────────────────────────────────
with open(registry_ts_path) as f:
    registry_text = f.read()

# ── Per-event checks ─────────────────────────────────────────────────────────
results = []
not_emitted = []

for key in required_list:
    # Layer 1: defined in registry.ts?
    defined_in_registry = ('"' + key + '"') in registry_text

    # Layer 2: grep app_dir for emit() call referencing this key
    # Match:  event: "<key>"  (with optional whitespace around colon)
    grep_pattern = 'event:[[:space:]]*"' + re.escape(key) + '"'
    proc = subprocess.run(
        ['grep', '-rn', '--include=*.ts', '--include=*.tsx', '-E', grep_pattern, app_dir],
        capture_output=True, text=True
    )

    emit_lines = [l.strip() for l in proc.stdout.strip().split('\n') if l.strip()]
    emitted_in_ui = len(emit_lines) > 0

    # Extract first emit site as relative path:line
    emit_site = None
    if emit_lines:
        first = emit_lines[0]
        # format: /abs/path/file.ts:123:  content...
        parts = first.split(':')
        if len(parts) >= 2:
            abs_file = parts[0]
            line_no = parts[1]
            # Make relative to repo root
            try:
                rel = os.path.relpath(abs_file, "$REPO_ROOT")
            except ValueError:
                rel = abs_file
            emit_site = f"{rel}:{line_no}"

    entry = {
        "key": key,
        "defined_in_registry": defined_in_registry,
        "emitted_in_ui": emitted_in_ui,
        "emit_site": emit_site,
    }
    results.append(entry)

    if not emitted_in_ui:
        not_emitted.append(key)

# ── Aggregate ─────────────────────────────────────────────────────────────────
required_count = len(required_list)
defined_count = sum(1 for r in results if r["defined_in_registry"])
emitted_count = sum(1 for r in results if r["emitted_in_ui"])
emit_coverage_pct = round(emitted_count / required_count * 100, 1) if required_count > 0 else 0.0

output = {
    "domain": domain,
    "app_subdir": app_subdir,
    "generated_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "aggregate": {
        "required": required_count,
        "defined_in_registry": defined_count,
        "emitted_in_ui": emitted_count,
        "not_emitted_count": required_count - emitted_count,
        "emit_coverage_pct": emit_coverage_pct,
    },
    "not_emitted": not_emitted,
    "events": results,
}

with open(output_path, 'w') as f:
    json.dump(output, f, indent=2)

# ── Human summary ─────────────────────────────────────────────────────────────
print(f"")
print(f"  Domain:        {domain}")
print(f"  App subdir:    {app_subdir}")
print(f"")
print(f"  Required events : {required_count}")
print(f"  Defined (L1)    : {defined_count}  ({round(defined_count/required_count*100,1) if required_count else 0}%)")
print(f"  Emitted (L2)    : {emitted_count}  ({emit_coverage_pct}%)")
print(f"  NOT emitted     : {required_count - emitted_count}")
print(f"")

if not_emitted:
    print(f"  NOT-EMITTED event keys:")
    for k in not_emitted:
        reg_status = "defined" if any(r["key"] == k and r["defined_in_registry"] for r in results) else "NOT-IN-REGISTRY"
        print(f"    - {k}  [{reg_status}]")
else:
    print(f"  All required events are emitted. Gate: PASS")

print(f"")
print(f"  Report: {output_path}")
print(f"")

# Exit 2 if any required events are not emitted
if not_emitted:
    sys.exit(2)
PYEOF

PYEXIT=$?

if [[ $PYEXIT -eq 2 ]]; then
  echo "Gate: FAIL — not all required events are emitted from UI code."
  exit 2
elif [[ $PYEXIT -ne 0 ]]; then
  echo "ERROR: emit-coverage check failed with exit $PYEXIT" >&2
  exit 1
fi
