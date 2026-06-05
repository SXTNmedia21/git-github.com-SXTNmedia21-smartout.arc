#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-avstand.sh — spacing/gap/margin fidelity
# Dim 4: avstand — gap + margin between elements
#
# Design contract (design-export/apps/web/pages/min-dag.css):
#   .md-head:           margin-bottom: 20px
#   .md-shift-top:      gap: 12px, margin-bottom: 12px
#   .md-shift-meta:     gap: 14px, margin-top: 11px
#   .md-shift-actions:  gap: 10px, margin-top: 16px
#   .md-task-row:       gap: 12px
#   .md-task-meta:      gap: 9px, margin-top: 3px
#   .md-prog:           gap: 14px
#   .md-quick:          gap: 10px
#   .so-grid-2:         gap: 16px
#   .so-stack:          gap: 16px
#   .brief-top:         gap: 11px, margin-bottom: 13px
#
# Confidence cap: 75.

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
css_clean = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)

def get_block(selector, text):
    pattern = re.escape(selector) + r'\s*\{([^}]*)\}'
    m = re.search(pattern, text)
    return m.group(1) if m else ''

def has_prop(block, prop, value):
    pattern = re.escape(prop) + r'\s*:\s*' + re.escape(value)
    return bool(re.search(pattern, block))

checks = []
def chk(desc, selector, prop, value):
    block = get_block(selector, css_clean)
    checks.append((desc, has_prop(block, prop, value)))

chk("md-head margin-bottom 20px",        ".md-head",          "margin-bottom", "20px")
chk("md-shift-top gap 12px",             ".md-shift-top",     "gap",           "12px")
chk("md-shift-top margin-bottom 12px",   ".md-shift-top",     "margin-bottom", "12px")
chk("md-shift-meta gap 14px",            ".md-shift-meta",    "gap",           "14px")
chk("md-shift-meta margin-top 11px",     ".md-shift-meta",    "margin-top",    "11px")
chk("md-shift-actions gap 10px",         ".md-shift-actions", "gap",           "10px")
chk("md-shift-actions margin-top 16px",  ".md-shift-actions", "margin-top",    "16px")
chk("md-task-row gap 12px",              ".md-task-row",      "gap",           "12px")
chk("md-task-meta gap 9px",              ".md-task-meta",     "gap",           "9px")
chk("md-task-meta margin-top 3px",       ".md-task-meta",     "margin-top",    "3px")
chk("md-prog gap 14px",                  ".md-prog",          "gap",           "14px")
chk("md-quick gap 10px",                 ".md-quick",         "gap",           "10px")
chk("so-grid-2 gap 16px",               ".so-grid-2",        "gap",           "16px")
chk("so-stack gap 16px",                ".so-stack",         "gap",           "16px")
chk("brief-top gap 11px",               ".brief-top",        "gap",           "11px")
chk("brief-top margin-bottom 13px",     ".brief-top",        "margin-bottom", "13px")

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0
confidence = 75

print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","note":"DRAFT. Gap/margin check: {passed}/{total} spacing rules match design spec."}}')
PY
