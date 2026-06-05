#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-padding.sh — padding fidelity (px per side)
# Dim 3: padding — measures top/right/bottom/left padding per key component
#
# Design contract (design-export/apps/web/pages/min-dag.css):
#   .md-shift:       padding: 20px 22px
#   .md-sbtn:        padding: 0 18px  (height: 40px)
#   .md-task-row:    padding: 12px 18px
#   .md-task-inner:  padding: 2px 18px 16px 54px
#   .md-prog:        padding: 14px 18px
#   .md-news-row:    padding: 12px 18px
#   .md-ws:          padding: 14px 16px
#   .md-rut:         padding: 11px 18px
#   .md-q:           padding: 14px 14px
#   .so-panel-head:  padding: 14px 18px
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

def has_padding(block, value):
    pattern = r'padding\s*:\s*' + re.escape(value)
    return bool(re.search(pattern, block))

def has_prop(block, prop, value):
    pattern = re.escape(prop) + r'\s*:\s*' + re.escape(value)
    return bool(re.search(pattern, block))

checks = []
def chk(desc, selector, prop, value, use_padding=False):
    block = get_block(selector, css_clean)
    result = (has_padding(block, value) if use_padding else has_prop(block, prop, value))
    checks.append((desc, result))

chk("md-shift padding 20px 22px",       ".md-shift",      "padding", "20px 22px", True)
chk("md-sbtn height 40px",              ".md-sbtn",       "height",  "40px")
chk("md-sbtn padding 0 18px",           ".md-sbtn",       "padding", "0 18px", True)
chk("md-task-row padding 12px 18px",    ".md-task-row",   "padding", "12px 18px", True)
chk("md-task-inner padding 4-side",     ".md-task-inner", "padding", "2px 18px 16px 54px", True)
chk("md-prog padding 14px 18px",        ".md-prog",       "padding", "14px 18px", True)
chk("md-news-row padding 12px 18px",    ".md-news-row",   "padding", "12px 18px", True)
chk("md-ws padding 14px 16px",          ".md-ws",         "padding", "14px 16px", True)
chk("md-rut padding 11px 18px",         ".md-rut",        "padding", "11px 18px", True)
chk("md-q padding 14px 14px",           ".md-q",          "padding", "14px 14px", True)
chk("so-panel-head padding 14px 18px",  ".so-panel-head", "padding", "14px 18px", True)

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0
confidence = 75

print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","note":"DRAFT. Static padding check: {passed}/{total} padding rules match design spec."}}')
PY
