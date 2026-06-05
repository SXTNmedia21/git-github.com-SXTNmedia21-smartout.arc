#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-skygge.sh — shadow fidelity
# Dim 6: skygge — box-shadow values
#
# Design contract (from styles.css tokens):
#   --sh-sm:    0 1px 2px rgba(0,0,0,0.05)
#   --sh-md:    0 4px 6px rgba(28,24,20,0.06), 0 1px 2px rgba(28,24,20,0.04)
#   --sh-glow:  0 2px 12px rgba(249,115,22,0.25)
#
# Key usages in min-dag.css live:
#   .md-q:hover    → box-shadow: var(--sh-md)
#   .brief-av      → box-shadow: var(--sh-glow)
#   .brief-act:hover → box-shadow: var(--sh-sm)
#
# IMPORTANT: confidence is LOW (40) for shadows.
# Shadow rendering is VISUAL — cannot be verified statically.
# This script checks token references only, not visual output.
# Pontus MUST visually verify this dim in browser.

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

checks = []

def has_in_text(pattern, text):
    return bool(re.search(pattern, text))

# brief-av must have box-shadow: var(--sh-glow)
m_brief_av = re.search(r'\.brief-av\s*\{([^}]*)\}', css_clean)
block_brief_av = m_brief_av.group(1) if m_brief_av else ''
checks.append(("brief-av box-shadow sh-glow", bool(re.search(r'box-shadow\s*:\s*var\(--sh-glow\)', block_brief_av))))

# md-q:hover must reference sh-md — hover selector block is separate
# Look for the hover variant of md-q
hover_block_q = re.search(r'\.md-q\s*:\s*hover\s*\{([^}]*)\}', css_clean)
block_q_hover = hover_block_q.group(1) if hover_block_q else ''
checks.append(("md-q:hover box-shadow sh-md", bool(re.search(r'box-shadow\s*:\s*var\(--sh-md\)', block_q_hover))))

# brief-act:hover must reference sh-sm
hover_act = re.search(r'\.brief-act\s*:\s*hover\s*\{([^}]*)\}', css_clean)
block_act_hover = hover_act.group(1) if hover_act else ''
checks.append(("brief-act:hover box-shadow sh-sm", bool(re.search(r'box-shadow\s*:\s*var\(--sh-sm\)', block_act_hover))))

# No raw box-shadow values (pixel-based not via token AND not via color-mix)
# Animation keyframes use "box-shadow: 0 0 0 Npx color-mix(...)" — those are token-based, not raw.
# True raw = box-shadow that references neither var() nor color-mix()
raw_shadows = [m for m in re.findall(r'box-shadow\s*:[^;]+', css_clean)
               if not re.search(r'var\(|color-mix', m)]
checks.append(("no raw box-shadow bypasses", len(raw_shadows) == 0))

passed = sum(1 for _, r in checks if r)
total = len(checks)
percent = (passed * 100) // total if total else 0

# Confidence: 40 — VISUAL DIM. Token reference check only.
# Actual rendered shadow cannot be verified without browser.
confidence = 40

raw_count = len([m for m in re.findall(r'box-shadow\s*:[^;]+', css_clean)
                 if not re.search(r'var\(|color-mix', m)])
print(f'{{"percent":{percent},"confidence":{confidence},"checks":"{passed}/{total}","raw_shadow_bypasses":{raw_count},"note":"DRAFT. LOW CONFIDENCE (40) — shadow rendering requires visual browser check. Token-reference check: {passed}/{total}. Pontus must visually verify."}}')
PY
