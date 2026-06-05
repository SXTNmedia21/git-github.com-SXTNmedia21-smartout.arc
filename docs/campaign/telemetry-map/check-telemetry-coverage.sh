#!/usr/bin/env bash
# check-telemetry-coverage.sh — Layer-2 telemetry coverage gate.
#
# WHAT THIS MEASURES (and what it does NOT):
#
#   LAYER-1 (defined)   — events declared in registry.ts / EVENT_ROUTING.
#                         Measured here as "events_defined".
#   LAYER-2 (emitted)   — events with an actual `emit({ event: "..." })` call-site
#                         in apps/web/src or apps/mobile/src, EXCLUDING registry.ts itself.
#                         Measured here as "events_emitted".  This is the gate metric.
#   LAYER-3 (landed)    — event fired a running app AND inserted a row in activity_trail.
#                         OUT OF SCOPE for this static gate.  Requires a running Supabase
#                         instance + browser interaction.  Extend via runtime Playwright
#                         spec that calls emit() and asserts the DB row post-flush.
#
# Usage:
#   check-telemetry-coverage.sh <domain> [prefix1 prefix2 ...]
#
#   domain    — e.g. min-dag  (maps to domain dir in telemetry-map/)
#   prefix*   — event-key prefixes to scan (e.g. min_dag  schedule  scheduler).
#               If omitted, the script derives one prefix from the domain name
#               (hyphens → underscores, e.g. min-dag → min_dag).
#
# Outputs:
#   docs/campaign/telemetry-map/reports/coverage-layer2-<domain>.json
#   Human summary to stdout
#
# Exit codes:
#   0  — all defined events have at least one emit call-site (layer-2 full coverage)
#   1  — usage / setup error
#   2  — one or more defined events have 0 emit call-sites (phantom events exist)
#
# READ-ONLY: this script never writes to apps/, registry.ts, or any database.
# It performs static grep/analysis only.

set -uo pipefail

# ─── Args ───────────────────────────────────────────────────────────────────
DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Usage: check-telemetry-coverage.sh <domain> [prefix1 prefix2 ...]" >&2
  echo "  e.g.: check-telemetry-coverage.sh min-dag" >&2
  echo "  e.g.: check-telemetry-coverage.sh vaktplan schedule scheduler shift_swap" >&2
  exit 1
fi

shift  # remaining args are optional prefixes
EXTRA_PREFIXES=("$@")

# Derive default prefix: hyphens to underscores
DEFAULT_PREFIX="${DOMAIN//-/_}"

# Build final prefix list (default + any extras, deduplicated)
declare -A SEEN_PREFIXES
PREFIX_LIST=()
for p in "$DEFAULT_PREFIX" "${EXTRA_PREFIXES[@]}"; do
  if [[ -z "${SEEN_PREFIXES[$p]+x}" ]]; then
    SEEN_PREFIXES[$p]=1
    PREFIX_LIST+=("$p")
  fi
done

# ─── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPORTS_DIR="$SCRIPT_DIR/reports"
REGISTRY_TS="$REPO_ROOT/packages/telemetry/src/registry.ts"
WEB_SRC="$REPO_ROOT/apps/web/src"
MOBILE_SRC="$REPO_ROOT/apps/mobile/src"
OUTPUT_JSON="$REPORTS_DIR/coverage-layer2-${DOMAIN}.json"

# ─── Validation ─────────────────────────────────────────────────────────────
if [[ ! -f "$REGISTRY_TS" ]]; then
  echo "ERROR: registry.ts not found at $REGISTRY_TS" >&2
  exit 1
fi

if [[ ! -d "$WEB_SRC" ]]; then
  echo "ERROR: web src not found at $WEB_SRC" >&2
  exit 1
fi

mkdir -p "$REPORTS_DIR"

# ─── Build app search paths ──────────────────────────────────────────────────
# Search ALL of apps/web/src + apps/mobile/src (not a single subdir).
# Events may be emitted from hooks, actions, or components in any subdirectory —
# a narrow subdir scope causes false "phantom" readings (this was the root bug
# in the previous emit-coverage.sh, which searched apps/web/src/components/day
# and missed MinDagView.tsx in apps/web/src/app/dashboard/min-dag-v2/).
APP_SEARCH_DIRS=()
[[ -d "$WEB_SRC" ]]    && APP_SEARCH_DIRS+=("$WEB_SRC")
[[ -d "$MOBILE_SRC" ]] && APP_SEARCH_DIRS+=("$MOBILE_SRC")

# Convert prefix list to a comma-separated string for Python
PREFIXES_CSV=$(printf "%s," "${PREFIX_LIST[@]}" | sed 's/,$//')

# ─── Python: discover events, check emit sites, write JSON ──────────────────
# Pass all shell variables as environment variables to avoid backtick expansion
# inside the heredoc (bash expands backticks even inside <<HEREDOC unless quoted).
# Using <<'PYEOF' prevents ALL bash expansion, so variables must come via env.
APP_SEARCH_DIRS_STR="${APP_SEARCH_DIRS[*]:-}"
export _STCOV_DOMAIN="$DOMAIN"
export _STCOV_REGISTRY="$REGISTRY_TS"
export _STCOV_REPO_ROOT="$REPO_ROOT"
export _STCOV_OUTPUT="$OUTPUT_JSON"
export _STCOV_PREFIXES_CSV="$PREFIXES_CSV"
export _STCOV_APP_DIRS="$APP_SEARCH_DIRS_STR"

python3 - <<'PYEOF'
import json
import re
import subprocess
import sys
import os
from datetime import datetime, timezone

# Read variables from environment (avoids bash backtick expansion in heredoc)
domain        = os.environ["_STCOV_DOMAIN"]
registry_path = os.environ["_STCOV_REGISTRY"]
repo_root     = os.environ["_STCOV_REPO_ROOT"]
output_path   = os.environ["_STCOV_OUTPUT"]
prefixes_csv  = os.environ["_STCOV_PREFIXES_CSV"]
app_dirs_raw  = os.environ.get("_STCOV_APP_DIRS", "")

# ── Parse inputs ─────────────────────────────────────────────────────────────
prefixes = [p.strip() for p in prefixes_csv.split(",") if p.strip()]
app_dirs = [d for d in app_dirs_raw.split() if d.strip() and os.path.isdir(d.strip())]

# ── Load registry.ts ─────────────────────────────────────────────────────────
with open(registry_path) as f:
    registry_text = f.read()

# ── Extract EVENT_ROUTING block (the authoritative runtime map) ───────────────
# The registry has two representations per event:
#   1. TypeScript interface: `event: "foo.bar";`   (appears ~twice — once per dual-registration)
#   2. EVENT_ROUTING entry: `"foo.bar": { destinations: [...], ... }`
#
# We scan EVENT_ROUTING keys because they are the canonical runtime set and each
# event appears exactly once there.  This avoids double-counting from interfaces.
routing_start = registry_text.find("export const EVENT_ROUTING")
if routing_start == -1:
    print("ERROR: EVENT_ROUTING not found in registry.ts", file=sys.stderr)
    sys.exit(1)

routing_block = registry_text[routing_start:]

# Match keys like:  "schedule.density_changed": {
# or:               "shift created": {
# IMPORTANT: use [^\n:] (no newline, no colon) to prevent the greedy `[^:]*`
# from consuming across line boundaries and spuriously matching category values
# like "navigation" on the next token that happens to precede ": {" on the next line.
routing_key_pattern = re.compile(r'"([a-z][a-z0-9_.]*(?:\s[a-z][a-z0-9_]*)?)"[^\n:]*:\s*\{')

all_routing_keys = set()
for m in routing_key_pattern.finditer(routing_block):
    all_routing_keys.add(m.group(1))

# ── Filter to events matching our domain prefixes ────────────────────────────
def matches_prefix(key: str, prefixes: list) -> bool:
    for p in prefixes:
        # Dotted: "min_dag.task.expanded" matches prefix "min_dag"
        if key.startswith(p + "."):
            return True
        # Legacy space-separated: "shift created" matches prefix "shift"
        if key.startswith(p + " ") or key == p:
            return True
    return False

defined_events = sorted(e for e in all_routing_keys if matches_prefix(e, prefixes))

# ── Per-event layer-2 check ───────────────────────────────────────────────────
# Search for:   event: "<key>"   (with optional whitespace around colon)
# in all .ts/.tsx files under app_dirs, EXCLUDING registry.ts itself.

results = []
emitted_keys = []
phantom_keys = []

registry_abs = os.path.abspath(registry_path)

for key in defined_events:
    escaped = re.escape(key)
    grep_pattern = f'event:[[:space:]]*"{escaped}"'

    emit_sites = []
    for app_dir in app_dirs:
        proc = subprocess.run(
            ["grep", "-rn", "--include=*.ts", "--include=*.tsx",
             "-E", grep_pattern, app_dir],
            capture_output=True, text=True
        )
        for line in proc.stdout.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            # Exclude registry.ts itself (it contains the key in type definitions)
            parts = line.split(":", 1)
            if not parts:
                continue
            abs_file = os.path.abspath(parts[0])
            if abs_file == registry_abs:
                continue
            emit_sites.append(line)

    emitted = len(emit_sites) > 0

    # First emit site as repo-relative path
    first_site = None
    if emit_sites:
        first = emit_sites[0]
        path_parts = first.split(":")
        if len(path_parts) >= 2:
            abs_file_str = path_parts[0]
            line_no      = path_parts[1]
            try:
                rel = os.path.relpath(abs_file_str, repo_root)
            except ValueError:
                rel = abs_file_str
            first_site = f"{rel}:{line_no}"

    results.append({
        "key":          key,
        "emitted":      emitted,
        "emit_site":    first_site,
        "emit_count":   len(emit_sites),
    })

    if emitted:
        emitted_keys.append(key)
    else:
        phantom_keys.append(key)

# ── Aggregate ─────────────────────────────────────────────────────────────────
events_defined  = len(defined_events)
events_emitted  = len(emitted_keys)
events_phantom  = len(phantom_keys)
coverage_pct    = round(events_emitted / events_defined * 100, 1) if events_defined > 0 else 0.0

output = {
    "domain":             domain,
    "event_prefixes":     prefixes,
    "search_dirs":        [os.path.relpath(d, repo_root) for d in app_dirs],
    "generated_at":       datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "layer": 2,
    "layer_note": (
        "Layer 2 = static grep for emit() call-sites in app source. "
        "Layer 3 (event lands a row in activity_trail) requires a running app "
        "and is out of scope for this static gate."
    ),
    "aggregate": {
        "events_defined":        events_defined,
        "events_emitted":        events_emitted,
        "events_phantom":        events_phantom,
        "coverage_layer2_pct":   coverage_pct,
        "gate":                  "PASS" if events_phantom == 0 and events_defined > 0 else "FAIL",
    },
    "phantom_events": phantom_keys,
    "events": results,
}

with open(output_path, "w") as f:
    json.dump(output, f, indent=2)

# ── Human summary ─────────────────────────────────────────────────────────────
gate_str = output["aggregate"]["gate"]
print(f"")
print(f"  Domain:           {domain}")
print(f"  Event prefixes:   {', '.join(prefixes)}")
print(f"  Search scope:     {', '.join(output['search_dirs'])}")
print(f"")
print(f"  Events defined (L1) : {events_defined}")
print(f"  Events emitted (L2) : {events_emitted}  ({coverage_pct}%)")
print(f"  Events phantom      : {events_phantom}")
print(f"")
print(f"  Gate (Layer 2)      : {gate_str}")
print(f"")

if phantom_keys:
    print(f"  PHANTOM events (defined in registry, 0 emit call-sites):")
    for k in phantom_keys:
        print(f"    - {k}")
    print(f"")
else:
    print(f"  All defined events have at least one emit call-site.  Gate: PASS")
    print(f"")

if emitted_keys:
    print(f"  EMITTED events (layer-2 covered):")
    for r in results:
        if r["emitted"]:
            site = r["emit_site"] or "(site unknown)"
            print(f"    + {r['key']}  @ {site}")
    print(f"")

print(f"  Report: {output_path}")
print(f"")

# ── Layer-3 reminder ──────────────────────────────────────────────────────────
print(f"  NOTE (Layer 3): verifying that emitted events land a row in activity_trail")
print(f"  requires a running app + runtime invocation — not measurable statically.")
print(f"  Extend via: Playwright spec -> emit() -> assert DB row in activity_trail.")
print(f"")

if phantom_keys:
    sys.exit(2)
PYEOF

PYEXIT=$?

if [[ $PYEXIT -eq 2 ]]; then
  echo "Gate: FAIL — phantom events exist (defined but 0 emit call-sites)."
  exit 2
elif [[ $PYEXIT -ne 0 ]]; then
  echo "ERROR: coverage check failed with exit $PYEXIT" >&2
  exit 1
fi
