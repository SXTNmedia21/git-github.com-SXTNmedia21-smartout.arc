#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-layout.sh — layout/flex/grid/alignment fidelity
# Dim 7: layout — flex/grid/order/align — where elements sit
#
# Design contract (design-export/apps/web/pages/min-dag.css):
#   .so-grid-2:     display:grid, grid-template-columns (2-col left-heavy)
#   .so-stack:      display:flex, flex-direction:column
#   .md-quick:      display:grid, grid-template-columns: repeat(2,1fr)
#   .md-weekstats:  display:grid, grid-template-columns: repeat(3,1fr)
#   .md-task-row:   display:grid, grid-template-columns: auto 1fr auto
#   .md-news-row:   display:flex, align-items:center
#   .brief-top:     display:flex, align-items:center
#   .so-panel-head: display:flex, align-items:center
#   .md-shift-meta: display:flex, align-items:center, flex-wrap:wrap
#   .md-prog:       display:flex, align-items:center
#
# Confidence cap: 55. Layout declarations are checkable; visual element placement and
# responsive wrapping behavior require browser.

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

# 2-col page grid
chk("so-grid-2 display grid",                ".so-grid-2",     "display", "grid")
# Grid-template-columns: any 2-col definition (value varies: 1.65fr 1fr or similar)
b = get_block(".so-grid-2", css_clean)
checks.append(("so-grid-2 two columns",      bool(re.search(r'grid-template-columns', b))))

# Stack
chk("so-stack display flex",                 ".so-stack",      "display",         "flex")
chk("so-stack flex-direction column",        ".so-stack",      "flex-direction",  "column")

# Quick actions 2×2
chk("md-quick display grid",                 ".md-quick",      "display",         "grid")
chk("md-quick 2 columns",                    ".md-quick",      "grid-template-columns", "repeat(2, 1fr)")

# Week stats 3-col
chk("md-weekstats display grid",             ".md-weekstats",  "display",         "grid")
chk("md-weekstats 3 columns",               ".md-weekstats",  "grid-template-columns", "repeat(3, 1fr)")

# Task row 3-col (auto | body | chevron)
chk("md-task-row display grid",              ".md-task-row",   "display",         "grid")
chk("md-task-row auto 1fr auto cols",       ".md-task-row",   "grid-template-columns", "auto 1fr auto")

# News row flex
chk("md-news-row display flex",              ".md-news-row",   "display",         "flex")
chk("md-news-row align-items center",        ".md-news-row",   "align-items",     "center")

# Brief top flex
chk("brief-top display flex",               ".brief-top",     "display",         "flex")
chk("brief-top align-items center",         ".brief-top",     "align-items",     "center")

# Panel head flex
chk("so-panel-head display flex",           ".so-panel-head", "display",         "flex")
chk("so-panel-head align-items center",     ".so-panel-head", "align-items",     "center")

# Shift meta wraps on overflow
chk("md-shift-meta flex-wrap wrap",         ".md-shift-meta", "flex-wrap",       "wrap")

# Progress row flex
chk("md-prog display flex",                 ".md-prog",       "display",         "flex")
chk("md-prog align-items center",           ".md-prog",       "align-items",     "center")

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0
confidence = 55

print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","note":"DRAFT. MEDIUM-LOW CONFIDENCE (55) — layout requires visual browser check. Structural declaration check: {passed}/{total} match."}}')
PY
