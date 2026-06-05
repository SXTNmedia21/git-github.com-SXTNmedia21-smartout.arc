#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-border-radius.sh — border-radius fidelity
# Dim 5: border-radius — runding px per hjørne
#
# Design contract:
#   Token map (styles.css): --r-sm:6px  --r-md:8px  --r-lg:10px
#                           --r-xl:14px  --r-card:16px  --r-full:9999px
#
#   .md-shift:       border-radius: var(--r-card)
#   .md-sbtn:        border-radius: 10px  [literal in design]
#   .md-check:       border-radius: 7px
#   .md-tbtn:        border-radius: 8px   [= --r-md]
#   .md-q:           border-radius: var(--r-xl)
#   .md-q-ic:        border-radius: 10px
#   .md-news-ic:     border-radius: 10px
#   .brief-av:       border-radius: 9px
#   .brief-why:      border-radius: 8px   [= --r-md]
#   .brief-act:      border-radius: 9px
#   .md-sub-box:     border-radius: 5px
#   .md-rut-ic:      border-radius: 9px
#   .so-panel:       border-radius: var(--r-card)
#   .md-haste:       border-radius: 999px
#   .md-pill:        border-radius: 999px
#
# Confidence cap: 78.

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
def chk(desc, selector, value):
    block = get_block(selector, css_clean)
    checks.append((desc, has_prop(block, "border-radius", value)))

chk("md-shift uses r-card token",     ".md-shift",    "var(--r-card)")
chk("so-panel uses r-card token",     ".so-panel",    "var(--r-card)")
chk("md-q uses r-xl token",           ".md-q",        "var(--r-xl)")
chk("md-sbtn border-radius 10px",     ".md-sbtn",     "10px")
chk("md-check border-radius 7px",     ".md-check",    "7px")
chk("md-tbtn border-radius 8px",      ".md-tbtn",     "8px")
chk("md-q-ic border-radius 10px",     ".md-q-ic",     "10px")
chk("md-news-ic border-radius 10px",  ".md-news-ic",  "10px")
chk("brief-av border-radius 9px",     ".brief-av",    "9px")
chk("brief-act border-radius 9px",    ".brief-act",   "9px")
chk("md-sub-box border-radius 5px",   ".md-sub-box",  "5px")
chk("md-rut-ic border-radius 9px",    ".md-rut-ic",   "9px")
chk("md-haste border-radius 999px",   ".md-haste",    "999px")
chk("md-pill border-radius 999px",    ".md-pill",     "999px")

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0
confidence = 78

print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","note":"DRAFT. Border-radius check: {passed}/{total} rules match design spec. Browser needed for computed corner verification."}}')
PY
