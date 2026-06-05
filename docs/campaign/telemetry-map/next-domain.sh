#!/usr/bin/env bash
# next-domain.sh — telemetry-driven dispatch driver.
#
# Reads the Completion Rate gate (reports/completion-rate.json) + each friction domain's
# control.json, ranks them, and emits a worklist brief for the next implementation unit.
# Telemetry drives WHAT gets built next — read from disk, no judgment.
#
# MODE (arg 1):
#   achievable (default) — nominate the WINNABLE domain: fewest high-severity blockers
#       (ADR / backend walls), then most missing events, then lowest rate. Surfaces a
#       clean domain where registering events lands NOW, before the ADR-heavy fights.
#   lowest — raw lowest completion rate (may be the most-blocked domain).
#
# Lane: MEASURE + NOMINATE only. A builder EXECUTES the brief (register events, wire
# hooks) — app code, not this driver's job.
#
# Usage: next-domain.sh [achievable|lowest]
set -uo pipefail
cd "$(dirname "$0")"
MODE="${1:-achievable}"
command -v jq >/dev/null 2>&1 || { echo "next-domain: jq required" >&2; exit 2; }
RATE=reports/completion-rate.json
[ -f "$RATE" ] || { echo "next-domain: run completion-rate.sh first ($RATE missing)" >&2; exit 2; }
jq -e '.gate_100' "$RATE" >/dev/null && { echo "Completion Rate at 100% — nothing to nominate."; exit 0; }

mapfile -t DOMS < <(jq -r '.friction[].domain' "$RATE")
[ "${#DOMS[@]}" -gt 0 ] || { echo "next-domain: no friction domain"; exit 0; }

# Score each friction domain from its control.json.
SCORE="[]"
for d in "${DOMS[@]}"; do
  [ -f "$d/control.json" ] || continue
  row="$(jq --arg d "$d" '{
    domain: $d,
    high_blockers: ([(.blockers // [])[] | select(type=="object" and .severity=="high")] | length),
    total_blockers: ((.blockers // []) | length),
    missing: ((.events_required // 0) - (.events_in_registry // 0)),
    rate_pct: (if (.events_required//0)>0 then (((.events_in_registry//0)/.events_required)*1000|floor)/10 else 100 end)
  }' "$d/control.json")"
  SCORE="$(jq --argjson r "$row" '. + [$r]' <<<"$SCORE")"
done

if [ "$MODE" = "lowest" ]; then
  RANKED="$(jq 'sort_by(.rate_pct)' <<<"$SCORE")"
else
  RANKED="$(jq 'sort_by(.high_blockers, (-.missing), .rate_pct)' <<<"$SCORE")"
fi
DOM="$(jq -r '.[0].domain' <<<"$RANKED")"
CTRL="$DOM/control.json"
[ -f "$CTRL" ] || { echo "next-domain: control.json missing for $DOM" >&2; exit 2; }

# Ranking table (why this domain).
echo "TELEMETRY-DRIVEN RANKING  (mode: $MODE)"
jq -r '.[] | "  \(.domain): \(.rate_pct)%  high-blockers \(.high_blockers)  missing \(.missing)"' <<<"$RANKED"
echo "  → nominated: $DOM"
echo

mkdir -p reports
jq -n --slurpfile r "$RATE" --slurpfile c "$CTRL" --arg dom "$DOM" --arg mode "$MODE" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  ($r[0].per_domain[] | select(.domain==$dom)) as $d |
  {
    nominated_at: $at,
    mode: $mode,
    domain: $dom,
    completion_rate_pct: (($d.completion_rate*1000|floor)/10),
    events_in_registry: $d.events_in_registry,
    events_required: $d.events_required,
    high_blockers: ([($c[0].blockers // [])[] | select(type=="object" and .severity=="high")] | length),
    missing_events: ($c[0].events_missing_from_registry // []),
    hooks_missing: ($c[0].hooks_missing // []),
    hooks_reusable: ($c[0].hooks_reusable // []),
    blockers: ($c[0].blockers // [])
  }' > reports/next-domain-brief.json

jq -r '
  "DISPATCH BRIEF — \(.domain)  (\(.completion_rate_pct)% — \(.events_in_registry)/\(.events_required) events, high-blockers \(.high_blockers))",
  "  register \(.missing_events|length) missing events:",
  (.missing_events[] | "      + \(.)"),
  "  \(.blockers|length) blockers (\(.high_blockers) high):",
  (.blockers[] | "      ! " + (if type=="object" then "[\(.severity)] \(.description)" else "[?] \(.)" end))
' reports/next-domain-brief.json
echo "  -> brief: reports/next-domain-brief.json  (BUILDER lane: register events + wire hooks)"
