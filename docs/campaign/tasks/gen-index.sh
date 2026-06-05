#!/usr/bin/env bash
# gen-index.sh — build tasks-index.json (what the live panel reads) from the task jsons.
# Carries per-dimension status so the panel modal shows the real 8-dim state, not a guess.
# Read-only on tasks; writes only docs/campaign/tasks-index.json.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(cd "$HERE/.." && pwd)/tasks-index.json"
python3 - "$HERE" "$OUT" <<'PY'
import json,os,sys,glob
here,out=sys.argv[1],sys.argv[2]
tasks=[]
for f in sorted(glob.glob(os.path.join(here,"*.task.json"))):
    t=json.load(open(f))
    subs=t.get("subtasks") or []
    lr=t.get("last_run") or {}
    detail=[{"dim":s.get("dim",s.get("n")),"status":s.get("status","pending"),
             "last_run":s.get("last_run",{})} for s in subs]
    green=sum(1 for s in subs if s.get("status")=="green")
    tasks.append({
        "id":t.get("id"),"label":t.get("label",t.get("id")),"kind":t.get("kind","?"),
        "assigned_to":t.get("assigned_to","?"),"page":t.get("page",""),
        "gate":t.get("gate_confidence",95),"subtasks":len(subs),
        "green":lr.get("green_dims",green),"cleared":bool(lr.get("cleared",lr.get("clear",False))),
        "ask":t.get("ask",""),"subtasks_detail":detail})
json.dump({"updated_by":"gen-index.sh","tasks":tasks},open(out,"w"),indent=2,ensure_ascii=False)
print(f"✔ wrote {out} · {len(tasks)} tasks")
PY
