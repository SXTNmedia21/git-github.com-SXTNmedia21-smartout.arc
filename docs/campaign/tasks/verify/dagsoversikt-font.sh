#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-font.sh — typography fidelity
# Dim 2: font — family · size(px) · weight · line-height · letter-spacing
#
# Design contract (design-export/apps/web/pages/min-dag.css):
#   .md-greet:      font-family:var(--font-heading), 40px, weight 400, lh 1.0, ls -0.02em
#   .md-shift-time: font-family:var(--font-mono), 40px, weight 700, lh 1, ls -0.03em
#   .md-task-title: 14px, weight 600, ls -0.005em, lh 1.3
#   .md-news-title: 13.5px, weight 600, lh 1.3
#   .md-ws-v:       font-family:var(--font-mono), 24px, weight 700, ls -0.02em
#
# Method: parse CSS ruleset blocks (multiline-aware via Python), then check
# properties within each selector's block.
#
# Confidence cap: 60. Declarations only — actual rendered font (OS font stack resolution,
# web font loading, fallback behavior) cannot be verified statically.

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LIVE_CSS="$REPO/apps/web/src/app/dashboard/min-dag-v2/_components/min-dag.css"

if [[ ! -f "$LIVE_CSS" ]]; then
  echo '{"percent":0,"confidence":0,"note":"MISSING: live min-dag.css not found"}'
  exit 0
fi

python3 - "$LIVE_CSS" <<'PY'
import re, sys

css = open(sys.argv[1]).read()
# Strip comments
css_clean = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)

def get_block(selector, text):
    """Return the CSS block content for a selector, or '' if not found."""
    # Match selector followed by { ... }
    pattern = re.escape(selector) + r'\s*\{([^}]*)\}'
    m = re.search(pattern, text)
    return m.group(1) if m else ''

def has_prop(block, prop, value):
    """Check if block contains 'prop: value' (whitespace-flexible)."""
    pattern = re.escape(prop) + r'\s*:\s*' + re.escape(value)
    return bool(re.search(pattern, block))

checks = []

def chk(desc, selector, prop, value):
    block = get_block(selector, css_clean)
    result = has_prop(block, prop, value)
    checks.append((desc, result))
    return result

# md-greet
chk("md-greet font-family token",    ".md-greet", "font-family", "var(--font-heading)")
chk("md-greet font-size 40px",       ".md-greet", "font-size", "40px")
chk("md-greet font-weight 400",      ".md-greet", "font-weight", "400")
chk("md-greet letter-spacing -0.02em", ".md-greet", "letter-spacing", "-0.02em")
chk("md-greet line-height 1",        ".md-greet", "line-height", "1")

# md-shift-time
chk("md-shift-time font-family mono", ".md-shift-time", "font-family", "var(--font-mono)")
chk("md-shift-time font-size 40px",   ".md-shift-time", "font-size", "40px")
chk("md-shift-time font-weight 700",  ".md-shift-time", "font-weight", "700")
chk("md-shift-time ls -0.03em",       ".md-shift-time", "letter-spacing", "-0.03em")

# md-task-title
chk("md-task-title font-size 14px",   ".md-task-title", "font-size", "14px")
chk("md-task-title font-weight 600",  ".md-task-title", "font-weight", "600")
chk("md-task-title ls -0.005em",      ".md-task-title", "letter-spacing", "-0.005em")
chk("md-task-title line-height 1.3",  ".md-task-title", "line-height", "1.3")

# md-ws-v (week stats value)
chk("md-ws-v font-family mono",   ".md-ws-v", "font-family", "var(--font-mono)")
chk("md-ws-v font-size 24px",     ".md-ws-v", "font-size", "24px")
chk("md-ws-v font-weight 700",    ".md-ws-v", "font-weight", "700")
chk("md-ws-v ls -0.02em",         ".md-ws-v", "letter-spacing", "-0.02em")

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0
confidence = 60

print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","note":"DRAFT. Font declaration check: {passed}/{total} typography rules match design spec. Browser/computed verification needed for full confidence."}}')
PY
