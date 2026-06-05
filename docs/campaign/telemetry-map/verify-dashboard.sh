#!/usr/bin/env bash
# verify-dashboard.sh — ground TRUTH of agent liveness, computed independently of any
# dashboard. The 10-min watchdog runs this and double-checks with Pontus. Truth source:
# feed + heartbeat on disk. Liveness = LATEST EVENT WINS (a logged-off agent is DONE even
# if a stall-alert fired mid-run). Flags "finished but maybe shown STALLED" drift.
set -uo pipefail
cd "$(dirname "$0")"
FEED=activity/feed.jsonl
HB=activity/heartbeat.jsonl
now=$(date +%s)
ACTIVE_WINDOW=90   # active NOW only if last feed event < 90s old and not a logoff/gate

epoch(){ date -u -d "$1" +%s 2>/dev/null || echo 0; }

active=0; done_=0; active_list=(); mislabel=()
for a in $(jq -r '.agent' "$FEED" 2>/dev/null | sort -u); do
  last=$(grep -F "\"agent\":\"$a\"" "$FEED" | tail -1)
  ev=$(printf '%s' "$last" | jq -r '.event'); lts=$(printf '%s' "$last" | jq -r '.ts')
  age=$(( now - $(epoch "$lts") ))
  finished=0; [[ "$ev" == "logoff" || "$ev" == "gate" ]] && finished=1
  if (( finished )); then
    done_=$((done_+1))
  elif (( age < ACTIVE_WINDOW )); then
    active=$((active+1)); active_list+=("$a(${age}s)")
  else
    done_=$((done_+1))   # logged on but silent past window = NOT active
  fi
  # mislabel: only GENUINE drift — a stall-alert NEWER than the agent's last event
  # (stalled after finishing). Historical alerts that fired BEFORE logoff are not drift;
  # latest-event-wins makes the agent DONE. (Fixed: was crying wolf on historical alerts.)
  if (( finished )); then
    newer_stall=0
    while IFS= read -r st; do
      [ -z "$st" ] && continue
      (( $(epoch "$st") > $(epoch "$lts") )) && newer_stall=$((newer_stall+1))
    done < <(grep -F "stall-alert" "$HB" 2>/dev/null | grep -F "\"agent\":\"$a\"" | jq -r '.ts // empty' 2>/dev/null)
    (( newer_stall > 0 )) && mislabel+=("$a (stall-alert AFTER finishing — genuine drift)")
  fi
done

beat=$(tail -1 "$HB" 2>/dev/null || echo '{}')
beat_detail=$(printf '%s' "$beat" | jq -r '.detail // "no beat"')
beat_ts=$(printf '%s' "$beat" | jq -r '.ts // "none"')
total_agents=$(jq -r '.agent' "$FEED" 2>/dev/null | sort -u | wc -l | tr -d ' ')

jq -n \
  --arg vat "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson active "$active" --argjson done "$done_" --argjson total "$total_agents" \
  --arg bts "$beat_ts" --arg bd "$beat_detail" \
  --argjson nmis "${#mislabel[@]}" \
  --args '
  {
    verified_at: $vat,
    truth: { active_now: $active, done_or_idle: $done, total_agents_seen: $total },
    active_agents: $ARGS.positional[0:'"${#active_list[@]}"'],
    latest_heartbeat: { ts: $bts, detail: $bd },
    finished_but_maybe_stalled: $nmis,
    mislabel_risk: $ARGS.positional['"${#active_list[@]}"':],
    verdict: (
      (if $active==0 then "0 agents active right now" else ($active|tostring)+" active" end)
      + (if $nmis>0 then " | DRIFT: "+($nmis|tostring)+" finished agent(s) may show STALLED (latest-event-wins violated)" else " | dashboard liveness consistent" end)
    )
  }' "${active_list[@]}" "${mislabel[@]}"
