#!/usr/bin/env bash
# DRAFT — UNAUTHORITATIVE. Awaiting Pontus sign-off. Thresholds and pass criteria
# are proposals only; founder approval required before this becomes the gate of record.
#
# dagsoversikt-tekst.sh — text content fidelity
# Dim 8: tekst — innhold + lengde (truncation, antall bokstaver)
#
# Design contract (from design-export/apps/web/pages/min-dag.jsx):
#   Greeting:        "God morgen, Jonas" (h1.md-greet — from greeting() fn + name)
#   Eyebrow:         "Min side · Fredag 30. mai 2026" (sk-eyebrow)
#   Shift status:    "Vakt starter snart" (.md-shift-status)
#   Shift role:      "Sous-chef · Kjøkken" (.md-shift-role)
#   Brief title:     "Morgenbrief" + "BOTSSON" tag
#   Quick labels:    "Mine vakter" / "Min lønn" / "Meldinger" / "Opplæring"
#   Week header:     "Min uke" (so-panel-head)
#   Week label row:  "Timer" / "Fullført" / "Streak"
#   Routines header: "Mine rutiner i dag"
#   News header:     "Siste nytt"
#   News item 1:     "Stort selskap i kveld"
#   News item 2:     "Petter fyller år i dag 🎂"
#   News item 3:     "Maria la igjen en melding"
#
# Method: grep live TSX for these Norwegian strings. Checks that copy was not changed
# during port (truncation, label drift, translation accidents).
#
# Confidence cap: 80. Text content is checkable statically from source files.
# Dynamic text (from DB, user session) is lower confidence — it will render differently
# in production. But the LABEL/copy strings (static UI text) are checkable.

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
LIVE_TSX="$REPO/apps/web/src/app/dashboard/min-dag-v2/_components/MinDagView.tsx"

if [[ ! -f "$LIVE_TSX" ]]; then
  echo '{"percent":0,"confidence":0,"note":"MISSING: live MinDagView.tsx not found"}'
  exit 0
fi

checks_pass=0
checks_total=0

check() {
  local desc="$1" string="$2"
  checks_total=$((checks_total + 1))
  if grep -qF "$string" "$LIVE_TSX" 2>/dev/null; then
    checks_pass=$((checks_pass + 1))
  fi
}

# Static label strings that must survive the port verbatim
check "eyebrow label (Min side)"         "Min side"
check "shift status text"                "Vakt starter snart"
check "brief title Morgenbrief"          "Morgenbrief"
check "brief BOTSSON tag"                "BOTSSON"
check "quick label Mine vakter"          "Mine vakter"
check "quick label Min lønn"             "Min lønn"
check "quick label Meldinger"            "Meldinger"
check "quick label Opplæring"            "Opplæring"
check "week section label"               "Min uke"
check "week stat Timer"                  "Timer"
check "week stat Fullført"               "Fullført"
check "week stat Streak"                 "Streak"
check "routines section label"           "Mine rutiner i dag"
check "news section label"               "Siste nytt"
# NOTE: news item text is data-driven from real DB announcements in live port —
# these strings are NOT hardcoded in TSX (correct behavior: no ghost data).
# We check for the news-rendering structure instead.
check "news rows rendered from data"     "newsRows.map"
check "news title slot present"          "md-news-title"
check "news empty state honest"          "newsRows.length === 0"

# Check task panel header
check "tasks panel label"                "Mine oppgaver"

# Truncation: check that long-text containers have min-width:0 (prevents overflow)
# Uses Python for multiline-aware CSS block inspection
LIVE_CSS="$REPO/apps/web/src/app/dashboard/min-dag-v2/_components/min-dag.css"
checks_total=$((checks_total + 1))
if [[ -f "$LIVE_CSS" ]]; then
  trunc_ok=$(python3 -c "
import re, sys
css = open('$LIVE_CSS').read()
css_clean = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)
found = bool(re.search(r'(md-task-body|md-news-body|md-rut-body)\s*\{[^}]*min-width:\s*0', css_clean))
print('1' if found else '0')
" 2>/dev/null || echo "0")
  [[ "$trunc_ok" == "1" ]] && checks_pass=$((checks_pass + 1))
fi

percent=0
if [[ $checks_total -gt 0 ]]; then
  percent=$(( (checks_pass * 100) / checks_total ))
fi

# Confidence: 80 — static strings are reliably greppable.
# Dynamic content (user name, date, task list from DB) is NOT checked — it would require
# a live render. The 80 confidence reflects: labels correct → likely correct; data
# strings are environment-dependent.
confidence=80

echo "{\"percent\":$percent,\"confidence\":$confidence,\"checks\":\"$checks_pass/$checks_total\",\"note\":\"DRAFT. Text content check: $checks_pass of $checks_total Norwegian label strings present in live TSX. Dynamic data (name, date, tasks from DB) not checked — needs browser.\"}"
