#!/usr/bin/env bash
# completion-rate.sh — Completion Rate gatecheck for the telemetry-coverage campaign.
#
# Reads every domain control.json, computes per-domain + aggregate Completion Rate
# (events_in_registry / events_required), and evaluates the formal DRIVE-TO-100 gate:
#   100% IFF domains_mapped == TARGET AND every domain (gate==PASS AND blockers==[] AND
#   all control_points true). Truth from disk — no judgment.
#
# Writes reports/completion-rate.json (machine-readable, the loop reads this).
# Exit 0 iff at 100%, else 1 (real gate). Exit 2 on tooling error.
#
# Usage: completion-rate.sh [target_domains]   (default 13)
set -uo pipefail
cd "$(dirname "$0")"
TARGET="${1:-13}"
command -v jq >/dev/null 2>&1 || { echo "completion-rate: jq required" >&2; exit 2; }
mkdir -p reports

shopt -s nullglob
CTRLS=(*/control.json)
[ "${#CTRLS[@]}" -gt 0 ] || { echo "completion-rate: no */control.json found" >&2; exit 2; }

AGG="$(jq -s '.' "${CTRLS[@]}")" || { echo "completion-rate: bad control.json" >&2; exit 2; }

OUT="$(jq -n --argjson agg "$AGG" --argjson target "$TARGET" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  ($agg | map({
      domain,
      events_required: (.events_required // 0),
      events_in_registry: (.events_in_registry // 0),
      completion_rate: (if (.events_required // 0) > 0
        then ((.events_in_registry // 0) / .events_required) else 1 end),
      gate: (.gate // "UNKNOWN"),
      blockers_count: ((.blockers // []) | length),
      control_points_pass: (((.control_points // {}) | to_entries | map(.value) | all)),
      domain_pass: ((.gate=="PASS")
        and (((.blockers // []) | length)==0)
        and (((.control_points // {}) | to_entries | map(.value) | all)))
    })) as $d
  | ($d | map(.events_required) | add // 0) as $req
  | ($d | map(.events_in_registry) | add // 0) as $reg
  | ($d | map(select(.domain_pass)) | length) as $passing
  | ($d | length) as $mapped
  | {
      computed_at: $at,
      target_domains: $target,
      domains_mapped: $mapped,
      domains_passing: $passing,
      events_required_total: $req,
      events_in_registry_total: $reg,
      overall_completion_rate: (if $req>0 then ($reg/$req) else 0 end),
      overall_completion_pct: (if $req>0 then (($reg/$req*1000|floor)/10) else 0 end),
      gate_100: (($mapped==$target) and ($passing==$mapped) and ($mapped>0)),
      per_domain: ($d | sort_by(.completion_rate)),
      friction: ($d | map(select(.domain_pass|not))
        | map({domain, completion_rate, blockers_count,
               missing_events: (.events_required - .events_in_registry)}))
    }
')" || { echo "completion-rate: compute failed" >&2; exit 2; }

echo "$OUT" > reports/completion-rate.json

echo "$OUT" | jq -r '
  "Completion Rate — telemetry coverage",
  "  domains mapped : \(.domains_mapped)/\(.target_domains)",
  "  domains passing: \(.domains_passing)/\(.domains_mapped)",
  "  events         : \(.events_in_registry_total)/\(.events_required_total) registered",
  "  OVERALL        : \(.overall_completion_pct)%",
  "  100% gate      : \(if .gate_100 then "PASS" else "FAIL" end)",
  "  —— lowest domains:",
  (.per_domain[:5][] | "    \(.domain): \((.completion_rate*100|floor))%  (\(.events_in_registry)/\(.events_required), blockers \(.blockers_count))")
'

jq -e '.gate_100' >/dev/null <<<"$OUT" && exit 0 || exit 1
