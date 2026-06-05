#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-farge.sh — color token fidelity
# Dim 1: farge — measures that live CSS uses design tokens (var(--*)) not raw hex/rgba values.
#
# Method: strip CSS comments first, then grep for raw hex/rgba. Comment lines often
# document the old value being replaced (e.g. "/* B3: #fff → var(--card) */") — those
# must not be counted as violations.
#
# Design contract: ADR-0366 + Nordic Split — no raw hex in app code (globals.css exempt).
# Raw hex/rgba in live declarations = design-token bypass = red.
#
# Confidence cap: 72. Static analysis only — browser computed-styles and Tailwind
# className scanning not done. TSX style={} props may still pass raw colors.

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LIVE_CSS="$REPO/apps/web/src/app/dashboard/min-dag-v2/_components/min-dag.css"
LIVE_TSX="$REPO/apps/web/src/app/dashboard/min-dag-v2/_components/MinDagView.tsx"

if [[ ! -f "$LIVE_CSS" ]]; then
  echo '{"percent":0,"confidence":0,"note":"MISSING: live min-dag.css not found"}'
  exit 0
fi

python3 - "$LIVE_CSS" "$LIVE_TSX" <<'PY'
import re, sys, os

css_path = sys.argv[1]
tsx_path = sys.argv[2] if len(sys.argv) > 2 else ""

css = open(css_path).read()

# Strip block comments /* ... */ (including multi-line)
css_clean = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)

# Count raw hex violations in declarations (not in comments, not in var() fallback chains)
# Pattern: a # followed by 3-8 hex digits NOT inside a var() function
hex_matches = re.findall(r'(?<![\w-])#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])', css_clean)
# Filter: allow oklch hash-reference notation (none expected) and keyframe names — none
hex_count = len(hex_matches)

# Count raw rgba()/rgb() NOT wrapped in color-mix() — color-mix is a token composition
rgba_in_clean = re.findall(r'rgba?\([^)]+\)', css_clean)
raw_rgba = [r for r in rgba_in_clean if not any(
    m.start() > css_clean.rfind('color-mix', 0, css_clean.find(r))
    for m in [type('M', (), {'start': lambda self: css_clean.rfind('color-mix', 0, css_clean.find(r))})()]
)]
# Simpler check: just grep lines for rgba not on same line as color-mix
raw_rgba_count = sum(1 for line in css_clean.splitlines()
                     if re.search(r'rgba?\(', line) and 'color-mix' not in line)

total_violations = hex_count + raw_rgba_count

# Scoring: ≤2 = 100%, ≤5 = 85%, ≤10 = 65%, >10 = 30%
if total_violations <= 2:
    percent = 100
elif total_violations <= 5:
    percent = 85
elif total_violations <= 10:
    percent = 65
else:
    percent = 30

# TSX scan for style={} raw colors
tsx_raw = 0
if tsx_path and os.path.isfile(tsx_path):
    tsx = open(tsx_path).read()
    tsx_raw = len(re.findall(r'style=\{[^}]*#[0-9a-fA-F]{3,8}', tsx))

deduct = min(tsx_raw * 10, 30)
percent = max(0, percent - deduct)

confidence = 72

print(f'{{"percent":{percent},"confidence":{confidence},"css_violations":{total_violations},"hex_violations":{hex_count},"rgba_violations":{raw_rgba_count},"tsx_style_raw":{tsx_raw},"note":"DRAFT. Token-compliance scan (comments stripped): {total_violations} raw-color violations in CSS declarations, {tsx_raw} in TSX style props."}}')
PY
