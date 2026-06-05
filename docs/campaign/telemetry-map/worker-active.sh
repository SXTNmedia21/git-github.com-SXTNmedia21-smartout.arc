#!/usr/bin/env bash
# worker-active.sh — race-guard for the campaign heartbeat triggers.
#
# Exit 0  => a worker IS active (foreman/builder mid-flight) -> caller should HOLD OFF.
# Exit 1  => no active worker                                -> caller may proceed.
#
# A worker is "active" if EITHER:
#   (a) an explicit sentinel file exists  (.worker-active here, or any .sxtn/locks/*.lock), OR
#   (b) the LAST line of activity/feed.jsonl is a logon/working with no later logoff
#       for the same agent.
#
# Pure read-only. Used as the `when`-inverse for campaign-next-domain so the measure/nominate
# pass never fires while the min-dag foreman (or any builder) is mid-sortie.
set -uo pipefail
cd "$(dirname "$0")"
SENTINEL=".worker-active"
PROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo ..)"
FEED="activity/feed.jsonl"

# (a) explicit sentinels
[ -f "$SENTINEL" ] && exit 0
if ls "$PROOT"/.sxtn/locks/*.lock >/dev/null 2>&1; then exit 0; fi

# (b) feed-derived: is the most-recent agent still logged on?
if [ -f "$FEED" ] && command -v jq >/dev/null 2>&1; then
  # last event per agent; if any agent's last event is logon|working|pending -> active
  active="$(jq -rs '
    map(select(type=="object" and .agent!=null))
    | group_by(.agent)
    | map(max_by(.ts))
    | map(select((.event=="logon" or .event=="working") and (.gate!="PASS")))
    | length' "$FEED" 2>/dev/null || echo 0)"
  [ "${active:-0}" -gt 0 ] && exit 0
fi
exit 1
