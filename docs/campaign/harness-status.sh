#!/usr/bin/env bash
# harness-status.sh — the dashboard, as a script. Three views, one glance:
#   BUILT    — what exists (registers: skills, tasks, agents, missions)
#   LOGS     — what we can read (activity_trail rows, agent-history, version-logs)
#   RUNTIME  — what's alive right now (web, panel, local supabase)
#
#   harness-status.sh            — all three views
#   harness-status.sh built|logs|runtime   — one view
#
# Read-only. No writes, no DB mutations. Probes only.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # repo root
CAMP="$ROOT/docs/campaign"
DBC="$(docker ps -q -f name=supabase_db_smartout 2>/dev/null | head -1)"

view_built() {
  echo "▶ built ───────────────────────────────────────"
  echo "  skills      $(ls "$ROOT/.claude/skills/" 2>/dev/null | wc -l | tr -d ' ')"
  echo "  tasks       $(ls "$CAMP/tasks/"*.task.json 2>/dev/null | wc -l | tr -d ' ')   (docs/campaign/tasks/)"
  python3 - "$CAMP" <<'PY'
import json,os,sys
camp=sys.argv[1]
def load(p):
    try: return json.load(open(os.path.join(camp,p)))
    except Exception: return None
wf=load("workforce.json") or {}
ag=wf.get("agents",[])
active=sum(1 for a in ag if a.get("status")=="active")
print(f"  agents      {len(ag)}   ({active} active)")
wl=load("worklist.json") or {}
items=wl.get("items",[])
from collections import Counter
c=Counter(i.get("status","?") for i in items)
done=c.get("done",0)
print(f"  missions    {len(items)}   ({done} done · " + " · ".join(f"{k}:{v}" for k,v in c.items() if k!='done') + ")")
PY
}

view_logs() {
  echo "▶ logs ─────────────────────────────────────────"
  if [ -n "$DBC" ]; then
    rows=$(docker exec -i "$DBC" psql -U postgres -tAc "select count(*) from activity_trail" 2>/dev/null | tr -d ' ')
    echo "  activity_trail   ${rows:-?} rows   (the done-oracle — L3 proof)"
  else
    echo "  activity_trail   (local DB down)"
  fi
  ah=$(find "$ROOT" -name "agent-history.jsonl" 2>/dev/null | head -1)
  [ -n "$ah" ] && echo "  agent-history    $(wc -l < "$ah" | tr -d ' ') lines   ($ah)" || echo "  agent-history    (none found)"
  vlog=$(ls "$CAMP/tasks/.history/"*.jsonl 2>/dev/null | wc -l | tr -d ' ')
  vchg=$(cat "$CAMP/tasks/.history/"*.jsonl 2>/dev/null | wc -l | tr -d ' ')
  echo "  task version-log ${vlog} tasks tracked · ${vchg} changes   (tasks/.history/)"
}

view_runtime() {
  echo "▶ runtime ──────────────────────────────────────"
  probe() { local code; code=$(curl -s -o /dev/null -w "%{http_code}" -m 3 "$2" 2>/dev/null);
            [ -n "$code" ] && [ "$code" != "000" ] && echo "  🟢 $1   $code" || echo "  🔴 $1   down"; }
  probe "web      :3060" "http://localhost:3060/"
  probe "panel    :8088" "http://localhost:8088/"
  probe "supabase :54321" "http://127.0.0.1:54321/rest/v1/"
}

case "${1:-all}" in
  built)   view_built ;;
  logs)    view_logs ;;
  runtime) view_runtime ;;
  all|*)   view_built; echo; view_logs; echo; view_runtime ;;
esac
