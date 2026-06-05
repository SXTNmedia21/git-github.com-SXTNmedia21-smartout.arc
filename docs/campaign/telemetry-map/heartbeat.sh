#!/usr/bin/env bash
# heartbeat.sh — the agent-liveness pulse. Polls activity/feed.jsonl, detects stalled
# agents (logged on but no progress > STALL secs), emits beats + stall-alerts to
# activity/heartbeat.jsonl. THIS is how we ensure agents work: a dark agent is visible.
# Channel: heartbeat. Stop with: touch .heartbeat-stop. Self-caps at MAX secs.
set -uo pipefail
cd "$(dirname "$0")"
FEED=activity/feed.jsonl
HB=activity/heartbeat.jsonl
STOP=.heartbeat-stop
STALL=120      # secs of silence on a logon/working agent => STALLED
BEAT=15        # beat interval
MAX=7200       # hard self-cap (2h) — never run forever
mkdir -p activity; rm -f "$STOP"
start=$(date +%s)

epoch(){ date -u -d "$1" +%s 2>/dev/null || echo 0; }

while :; do
  now=$(date +%s); ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  [ -f "$STOP" ] && { printf '{"ts":"%s","channel":"heartbeat","event":"stopped","detail":"stop flag"}\n' "$ts" >> "$HB"; break; }
  (( now - start > MAX )) && { printf '{"ts":"%s","channel":"heartbeat","event":"stopped","detail":"max runtime"}\n' "$ts" >> "$HB"; break; }

  live=0; working=0; stalled=0; done_=0
  if [ -f "$FEED" ]; then
    for a in $(jq -r '.agent' "$FEED" 2>/dev/null | sort -u); do
      last=$(grep -F "\"agent\":\"$a\"" "$FEED" | tail -1)
      [ -z "$last" ] && continue
      ev=$(printf '%s' "$last" | jq -r '.event'); lts=$(printf '%s' "$last" | jq -r '.ts')
      age=$(( now - $(epoch "$lts") ))
      case "$ev" in
        logoff|gate) done_=$((done_+1)) ;;
        logon|working|delivered)
          if (( age > STALL )); then
            stalled=$((stalled+1))
            printf '{"ts":"%s","channel":"heartbeat","event":"stall-alert","agent":"%s","detail":"no progress %ss (last: %s)","gate":null}\n' "$ts" "$a" "$age" "$ev" >> "$HB"
          else
            working=$((working+1)); live=$((live+1))
          fi ;;
      esac
    done
  fi
  printf '{"ts":"%s","channel":"heartbeat","event":"beat","detail":"%s live / %s working / %s stalled / %s done","live":%s,"working":%s,"stalled":%s,"done":%s}\n' \
    "$ts" "$live" "$working" "$stalled" "$done_" "$live" "$working" "$stalled" "$done_" >> "$HB"
  sleep "$BEAT"
done
