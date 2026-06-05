#!/usr/bin/env bash
# render-log.sh — designed TEXT log of agent activity. Reads activity/feed.jsonl +
# latest heartbeat beat. Prints to stdout AND writes LIVE-LOG.txt. Tail-able, server-free.
# Columns: time · glyph · EVENT · agent · domain · detail (elements sent + counts).
set -uo pipefail
cd "$(dirname "$0")"
FEED=activity/feed.jsonl
HB=activity/heartbeat.jsonl
OUT=LIVE-LOG.txt
W=78
line(){ printf '%*s\n' "$W" '' | tr ' ' "$1"; }

{
  beat=$(tail -1 "$HB" 2>/dev/null || true)
  hbts=$(printf '%s' "$beat" | jq -r '.ts // "—"' 2>/dev/null || echo "—")
  hbd=$(printf '%s' "$beat" | jq -r '.detail // "no beat yet"' 2>/dev/null || echo "no beat")
  alerts=$(grep -c '"stall-alert"' "$HB" 2>/dev/null | head -1); alerts=${alerts:-0}
  echo "┌──────────────────────────────────────────────────────────────────────────────┐"
  printf '│  TELEMETRY-MAP · LIVE LOG%52s│\n' ""
  printf '│  heartbeat ● %-8s  %-44s %s│\n' "${hbts:11:8}" "$hbd" "$( [ "$alerts" -gt 0 ] && echo "⚠$alerts" || echo "  " )"
  echo "└──────────────────────────────────────────────────────────────────────────────┘"
  echo
  if [ ! -s "$FEED" ]; then echo "  (no activity yet)"; else
  jq -r '[.ts,.event,(.agent//"-"),(.domain//"-"),(.detail//""),(.gate//"")]|@tsv' "$FEED" 2>/dev/null \
  | while IFS=$'\t' read -r ts ev ag dom detail gate; do
      tm=${ts:11:8}
      case "$ev" in
        logon)     g="▶";  E="LOGON" ;;
        working)   g="·";  E="WORK"  ;;
        delivered) g="✎";  E="SEND"  ;;
        gate)      g="◆";  E="GATE"  ;;
        logoff)    g="◀";  E="LOGOFF";;
        *)         g=" ";  E="$ev"   ;;
      esac
      [ "$ev" = "gate" ] && [ -n "$gate" ] && detail="$gate · $detail"
      printf '  %s  %s  %-6s  %-16s %-13s %s\n' "$tm" "$g" "$E" "$ag" "$dom" "$detail"
    done
  fi
  echo
  line '─'
} | tee "$OUT"
