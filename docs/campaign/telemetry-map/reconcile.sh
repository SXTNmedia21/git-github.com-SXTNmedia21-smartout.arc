#!/usr/bin/env bash
# reconcile.sh — READ-ONLY reconcile of campaign control.json maps against registry.ts truth.
#
# The maps list events_missing_from_registry. Many were added to registry.ts later (F0.1
# design-ingest) but the maps were never updated → stale → Completion Rate understated.
# This recomputes the REAL coverage by checking each "missing" event against registry.ts.
#
# Does NOT mutate control.json. Writes reports/reconcile-real-rate.json + prints a summary.
# Lesson: stale derived-map vs source-of-truth (registry.ts).
set -uo pipefail
cd "$(dirname "$0")"
command -v jq >/dev/null 2>&1 || { echo "reconcile: jq required" >&2; exit 2; }
ROOT="$(git rev-parse --show-toplevel)"
REG="$ROOT/packages/telemetry/src/registry.ts"
[ -f "$REG" ] || { echo "reconcile: registry.ts not found at $REG" >&2; exit 2; }

shopt -s nullglob
ROWS="[]"
for c in */control.json; do
  dom="$(dirname "$c")"
  inreg="$(jq '.events_in_registry // 0' "$c")"
  req="$(jq '.events_required // 0' "$c")"
  false_missing=0; real_missing=0
  while IFS= read -r e; do
    [ -z "$e" ] && continue
    if grep -qF "\"$e\"" "$REG"; then false_missing=$((false_missing+1)); else real_missing=$((real_missing+1)); fi
  done < <(jq -r '.events_missing_from_registry[]?' "$c")
  # Truthful covered = required minus what is GENUINELY absent from registry.ts.
  # (stated + false_missing over-counts when a map's missing-list is internally inconsistent.)
  real_inreg=$((req - real_missing)); [ "$real_inreg" -lt 0 ] && real_inreg=0
  row="$(jq -n --arg d "$dom" --argjson ir "$inreg" --argjson req "$req" \
    --argjson fm "$false_missing" --argjson rm "$real_missing" --argjson rir "$real_inreg" '{
      domain:$d, stated_in_registry:$ir, required:$req,
      false_missing:$fm, genuinely_missing:$rm, real_in_registry:$rir,
      stated_rate_pct: (if $req>0 then (($ir/$req)*1000|floor)/10 else 100 end),
      real_rate_pct:   (if $req>0 then (($rir/$req)*1000|floor)/10 else 100 end)
    }')"
  ROWS="$(jq --argjson r "$row" '. + [$r]' <<<"$ROWS")"
done

OUT="$(jq -n --argjson rows "$ROWS" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
  ($rows|map(.required)|add // 0) as $req
  | ($rows|map(.stated_in_registry)|add // 0) as $stated
  | ($rows|map(.real_in_registry)|add // 0) as $real
  | ($rows|map(.false_missing)|add // 0) as $fm
  | ($rows|map(.genuinely_missing)|add // 0) as $gm
  | {
      reconciled_at:$at, source_of_truth:"packages/telemetry/src/registry.ts",
      events_required_total:$req,
      stated_in_registry_total:$stated,
      real_in_registry_total:$real,
      false_missing_total:$fm,
      genuinely_missing_total:$gm,
      stated_rate_pct:(if $req>0 then ($stated/$req*1000|floor)/10 else 0 end),
      real_rate_pct:  (if $req>0 then ($real/$req*1000|floor)/10 else 0 end),
      per_domain:($rows|sort_by(.real_rate_pct))
    }')"
mkdir -p reports
echo "$OUT" > reports/reconcile-real-rate.json
echo "$OUT" | jq -r '
  "RECONCILE — control.json maps vs registry.ts truth",
  "  events required          : \(.events_required_total)",
  "  STATED in registry (maps): \(.stated_in_registry_total)  → \(.stated_rate_pct)%",
  "  REAL in registry (truth) : \(.real_in_registry_total)  → \(.real_rate_pct)%",
  "  false-missing (stale map): \(.false_missing_total)",
  "  genuinely missing        : \(.genuinely_missing_total)",
  "  —— per domain (real rate):",
  (.per_domain[] | "    \(.domain): stated \(.stated_rate_pct)% → REAL \(.real_rate_pct)%  (false-missing \(.false_missing), genuine \(.genuinely_missing))")
'
