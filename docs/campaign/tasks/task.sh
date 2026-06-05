#!/usr/bin/env bash
# task.sh — the ONE control surface for tasks. Where they live, how they change, full history.
#
# Tasks are the most important artifact in the harness: each one carries a verify_script the agent
# RUNS but does NOT write. The script is the truth the agent cannot fake. This CLI gives Pontus
# full control: location (fixed here), change (every edit logged), version-log (append-only history).
#
#   task.sh list                      — all tasks + status (what exists, where, how green)
#   task.sh show   <id>               — full task json
#   task.sh set    <id> <field> <val> — change one field; logs old→new to version-log
#   task.sh history<id>               — the version-log for one task (every change, who, when)
#   task.sh verify <id>               — run its verify-script(s) → percent/confidence → gate
#   task.sh new    <id> <ask>         — scaffold a minimal task
#
# Version-log: tasks/.history/<id>.jsonl  (append-only, one JSON line per change)
# WHO: $TASK_ACTOR (default "pontus") — set it when an agent edits, so authorship is honest.

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HIST="$HERE/.history"
ACTOR="${TASK_ACTOR:-pontus}"
mkdir -p "$HIST"

# UTC timestamp passed in (Date.now banned in some contexts; here we use date directly — bash, not JS)
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

taskfile() { echo "$HERE/$1.task.json"; }

die() { echo "✖ $*" >&2; exit 1; }

cmd="${1:-list}"; shift || true

case "$cmd" in
list)
  echo "▶ tasks  (home: docs/campaign/tasks/)"
  shopt -s nullglob
  for f in "$HERE"/*.task.json; do
    python3 - "$f" <<'PY'
import json,sys
t=json.load(open(sys.argv[1]))
tid=t.get("id","?"); kind=t.get("kind","?"); who=t.get("assigned_to","?")
subs=t.get("subtasks") or []
lr=t.get("last_run") or {}
if subs:
    g=lr.get("green_dims","?"); tot=lr.get("total_dims",len(subs)); cleared=lr.get("cleared",False)
    state=f"{g}/{tot} dims" + (" ✅" if cleared else "")
else:
    p=lr.get("percent","–"); c=lr.get("confidence","–"); cleared=lr.get("cleared",False)
    state=f"{p}% conf={c}%" + (" ✅" if cleared else "")
print(f"  {tid:<26} {kind:<14} {who:<12} {state}")
PY
  done
  ;;

show)
  id="${1:?usage: task.sh show <id>}"; f="$(taskfile "$id")"
  [ -f "$f" ] || die "no task: $id"
  cat "$f"
  ;;

history)
  id="${1:?usage: task.sh history <id>}"; h="$HIST/$id.jsonl"
  [ -f "$h" ] || { echo "(no history yet for $id)"; exit 0; }
  echo "▶ version-log — $id"
  python3 - "$h" <<'PY'
import json,sys
for line in open(sys.argv[1]):
    line=line.strip()
    if not line: continue
    e=json.loads(line)
    print(f"  {e['ts']}  {e['actor']:<10} {e['field']:<18} {e.get('old','∅')!r} → {e.get('new','∅')!r}")
PY
  ;;

set)
  id="${1:?usage: task.sh set <id> <field> <val>}"; field="${2:?field}"; shift 2
  val="$*"; f="$(taskfile "$id")"
  [ -f "$f" ] || die "no task: $id"
  TS="$(now)" ACTOR="$ACTOR" FIELD="$field" VAL="$val" HIST="$HIST/$id.jsonl" python3 - "$f" <<'PY'
import json,os,sys
f=sys.argv[1]; field=os.environ["FIELD"]; val=os.environ["VAL"]
t=json.load(open(f))
old=t.get(field)
# coerce numbers/bools where it makes sense
nv=val
if val.lower() in ("true","false"): nv=val.lower()=="true"
else:
    try: nv=int(val)
    except ValueError:
        try: nv=float(val)
        except ValueError: nv=val
t[field]=nv
json.dump(t,open(f,"w"),indent=2,ensure_ascii=False)
open(f,"a").write("\n")
entry={"ts":os.environ["TS"],"actor":os.environ["ACTOR"],"field":field,"old":old,"new":nv}
open(os.environ["HIST"],"a").write(json.dumps(entry,ensure_ascii=False)+"\n")
print(f"✔ {field}: {old!r} → {nv!r}  (logged)")
PY
  ;;

verify)
  id="${1:?usage: task.sh verify <id>}"; f="$(taskfile "$id")"
  [ -f "$f" ] || die "no task: $id"
  echo "▶ verify — $id"
  bash "$HERE/run-verify.sh" "$f"
  rc=$?
  # log the verify outcome to version-log so every run is on the record
  TS="$(now)" ACTOR="$ACTOR" HIST="$HIST/$id.jsonl" RC="$rc" python3 - "$f" <<'PY'
import json,os,sys
t=json.load(open(sys.argv[1])); lr=t.get("last_run") or {}
entry={"ts":os.environ["TS"],"actor":os.environ["ACTOR"],"field":"verify_run",
       "old":None,"new":{"rc":int(os.environ["RC"]),"last_run":lr}}
open(os.environ["HIST"],"a").write(json.dumps(entry,ensure_ascii=False)+"\n")
PY
  exit $rc
  ;;

new)
  id="${1:?usage: task.sh new <id> <ask>}"; shift; ask="$*"
  f="$(taskfile "$id")"
  [ -f "$f" ] && die "exists: $id"
  cat > "$f" <<JSON
{
  "id": "$id",
  "kind": "ui",
  "ask": "$ask",
  "verify_script": "verify/$id.sh",
  "gate_confidence": 95,
  "last_run": {}
}
JSON
  TS="$(now)" ACTOR="$ACTOR" HIST="$HIST/$id.jsonl" python3 - <<PY
import json,os
entry={"ts":os.environ["TS"],"actor":os.environ["ACTOR"],"field":"created","old":None,"new":"$ask"}
open(os.environ["HIST"],"a").write(json.dumps(entry,ensure_ascii=False)+"\n")
PY
  echo "✔ created $id  (verify-script stub goes in verify/$id.sh — Pontus owns it)"
  ;;

*)
  echo "task.sh — list | show <id> | set <id> <field> <val> | history <id> | verify <id> | new <id> <ask>"
  ;;
esac
