#!/usr/bin/env bash
# gen-dashboard.sh — aggregate per-domain control.json → DASHBOARD.html + F0.1 worklist.
# Re-run whenever a domain's control.json changes. No judgment — it renders the mechanical gate.
set -uo pipefail
cd "$(dirname "$0")"

# 1. Combine all control.json (shell-glob = alphabetical)
jq -s '.' */control.json > AGGREGATE-control.json

# 2. F0.1 reconcile worklist — every missing event across all domains, unique
jq -r '[.[].events_missing_from_registry[]?] | unique | .[]' AGGREGATE-control.json > F0.1-missing-events.txt
MISSING_TOTAL=$(wc -l < F0.1-missing-events.txt | tr -d ' ')

# 3. Roll-up counts
PASS=$(jq '[.[]|select(.gate=="PASS")]|length' AGGREGATE-control.json)
FAIL=$(jq '[.[]|select(.gate=="FAIL")]|length' AGGREGATE-control.json)
DOMAINS=$(jq 'length' AGGREGATE-control.json)
ELEMENTS=$(jq '[.[].interactive_elements_total]|add' AGGREGATE-control.json)
MUTATIONS=$(jq '[.[].mutations]|add' AGGREGATE-control.json)

DATA=$(jq -c '.' AGGREGATE-control.json)
GEN_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

cat > DASHBOARD.html <<HTML
<!doctype html><html lang="no"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Telemetry-Map Dashboard</title>
<style>
  :root{--cream:#f6f3ec;--ink:#1a1714;--mut:#7a7164;--line:#e3ddd0;--green:#2e7d52;--amber:#c98a1a;--red:#c0392b;--brand:#e8631a;--card:#fffdf8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--cream);color:var(--ink);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:1180px;margin:0 auto;padding:32px 20px 64px}
  h1{font-size:26px;margin:0 0 4px;font-weight:650}
  .sub{color:var(--mut);margin:0 0 24px;font-size:13px}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
  .kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
  .kpi .n{font-size:28px;font-weight:680;font-variant-numeric:tabular-nums}
  .kpi .l{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  th,td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--line);font-size:13px;vertical-align:top}
  th{background:#efe9dd;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}
  td.num{font-variant-numeric:tabular-nums;text-align:right}
  .dom{font-weight:640;font-size:14px}
  .pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.03em}
  .PASS{background:#dff0e6;color:var(--green)}
  .FAIL{background:#f7e0dc;color:var(--red)}
  .cp{display:flex;gap:4px;flex-wrap:wrap}
  .dot{width:13px;height:13px;border-radius:4px;display:inline-block}
  .ok{background:var(--green)}.no{background:var(--red)}
  .gap{color:var(--red);font-size:12px}
  .mut{color:var(--mut);font-size:12px}
  .legend{margin:18px 0 6px;color:var(--mut);font-size:12px}
  details{margin-top:22px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
  summary{cursor:pointer;font-weight:620}
  code{background:#efe9dd;padding:1px 6px;border-radius:5px;font-size:12px}
  .evlist{columns:2;font-size:12px;color:var(--ink);margin-top:10px}
</style></head><body><div class="wrap">
<h1>Telemetry-Map Dashboard <span class="mut" style="font-size:14px">· redesign-wiring</span></h1>
<p class="sub">The wayfinder. Mechanical control points — green = proven on disk, not a vote. Generated ${GEN_AT}</p>
<div class="kpis">
  <div class="kpi"><div class="n">${DOMAINS}</div><div class="l">Domains mapped</div></div>
  <div class="kpi"><div class="n" style="color:var(--green)">${PASS}</div><div class="l">Gate PASS</div></div>
  <div class="kpi"><div class="n" style="color:var(--red)">${FAIL}</div><div class="l">Gate FAIL (honest)</div></div>
  <div class="kpi"><div class="n">${ELEMENTS}</div><div class="l">Interactive elements (baseline)</div></div>
  <div class="kpi"><div class="n">${MUTATIONS}</div><div class="l">Mutations</div></div>
  <div class="kpi"><div class="n" style="color:var(--amber)">${MISSING_TOTAL}</div><div class="l">Events to register (F0.1)</div></div>
</div>
<p class="legend">Control points (left→right): mapped · mutation→event · registry-status-known · mutation→hook/flagged · baseline-recorded</p>
<table><thead><tr>
  <th>Domain</th><th>Gate</th><th>Control points</th><th class="num">Elem</th><th class="num">Mut</th>
  <th class="num">Ev miss</th><th class="num">Hooks miss</th><th>Top blockers</th>
</tr></thead><tbody id="rows"></tbody></table>
<details><summary>F0.1 reconcile worklist — ${MISSING_TOTAL} unique events to register/reconcile before wiring</summary>
<div class="evlist" id="evlist"></div></details>
<script>
const DATA = ${DATA};
const cp = o => ['every_element_mapped','every_mutation_has_event','every_event_registry_status_known','every_mutation_has_hook_or_flagged','baseline_count_recorded']
  .map(k=>'<span class="dot '+((o.control_points||{})[k]?'ok':'no')+'" title="'+k+'"></span>').join('');
const n = v => (v==null?0:(Array.isArray(v)?v.length:v));
document.getElementById('rows').innerHTML = DATA.map(d=>{
  const evMiss=n(d.events_missing_from_registry), hkMiss=n(d.hooks_missing);
  const bl=(d.blockers||[]).slice(0,2).map(b=>'<div class="gap">• '+b+'</div>').join('')||'<span class="mut">—</span>';
  return '<tr><td class="dom">'+d.domain+'</td>'
    +'<td><span class="pill '+d.gate+'">'+d.gate+'</span></td>'
    +'<td><div class="cp">'+cp(d)+'</div></td>'
    +'<td class="num">'+n(d.interactive_elements_total)+'</td>'
    +'<td class="num">'+n(d.mutations)+'</td>'
    +'<td class="num" style="color:'+(evMiss?'var(--red)':'var(--green)')+'">'+evMiss+'</td>'
    +'<td class="num" style="color:'+(hkMiss?'var(--red)':'var(--green)')+'">'+hkMiss+'</td>'
    +'<td>'+bl+'</td></tr>';
}).join('');
const allEv=[...new Set(DATA.flatMap(d=>d.events_missing_from_registry||[]))].sort();
document.getElementById('evlist').innerHTML = allEv.map(e=>'<div><code>'+e+'</code></div>').join('');
</script>
</div></body></html>
HTML

echo "DASHBOARD.html written. domains=$DOMAINS pass=$PASS fail=$FAIL elements=$ELEMENTS mutations=$MUTATIONS missing_events=$MISSING_TOTAL"
