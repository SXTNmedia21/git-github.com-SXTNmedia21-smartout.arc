#!/usr/bin/env bash
# live-feed.sh — pull live SmartOut telemetry from the real sinks into live.json.
#
# The rich dashboard bakes its data at generation time; this feeds a LIVE panel instead.
# Reads the queryable telemetry sinks (activity_trail = main, engine_event) from the local
# Supabase DB and writes ./live.json. Read-only (server-enforced). Loop with --watch.
#
#   ./live-feed.sh            # write live.json once
#   ./live-feed.sh --watch    # refresh every 5s until Ctrl-C
#
# Override the DB with SXTN_DB_LOCAL (default = local SmartOut stack on 54322).

set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

CONN="${SXTN_DB_LOCAL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
OUT="live.json"

resolve_psql() {
  command -v psql >/dev/null 2>&1 && { echo psql; return; }
  for c in /home/linuxbrew/.linuxbrew/opt/libpq/bin/psql /opt/homebrew/opt/libpq/bin/psql /usr/local/opt/libpq/bin/psql; do
    [[ -x "$c" ]] && { echo "$c"; return; }
  done
  echo "psql"
}
PSQL="$(resolve_psql)"

# One read-only query → one JSON document built server-side.
SQL=$(cat <<'EOSQL'
select json_build_object(
  'generated_at', to_char(now() at time zone 'utc','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'sinks', json_build_object(
     'activity_trail', (select count(*) from activity_trail),
     'engine_event',   (select count(*) from engine_event),
     'billing_activity_log', (select count(*) from billing_activity_log)
  ),
  'span', (select json_build_object(
     'first', min(created_at), 'last', max(created_at),
     'event_types', count(distinct event), 'workspaces', count(distinct workspace_id)
   ) from activity_trail),
  'by_category', coalesce((select json_agg(x order by x.n desc) from
     (select category, count(*) n from activity_trail group by category) x),'[]'::json),
  'by_event', coalesce((select json_agg(x) from
     (select event, count(*) n from activity_trail group by event order by count(*) desc limit 25) x),'[]'::json),
  'recent', coalesce((select json_agg(x) from
     (select to_char(created_at at time zone 'utc','HH24:MI:SS') ts, event, category,
             coalesce(actor_kind,'?') actor, coalesce(entity_label,'') entity, coalesce(source,'') source
      from activity_trail order by created_at desc limit 50) x),'[]'::json)
);
EOSQL
)

write_once() {
  local json
  json="$(PGOPTIONS='-c default_transaction_read_only=on' "$PSQL" "$CONN" -tAqc "$SQL" 2>err.tmp)" || {
    echo "{\"error\":\"$(tr '\n' ' ' <err.tmp | sed 's/\"/'"'"'/g')\",\"generated_at\":\"$(date -u +%FT%TZ)\"}" > "$OUT"
    rm -f err.tmp; echo "feed error → $OUT" >&2; return 1
  }
  rm -f err.tmp
  printf '%s\n' "$json" > "$OUT"
  echo "live.json written ($(printf '%s' "$json" | wc -c) bytes) — $(date -u +%T)Z"
}

if [[ "${1:-}" == "--watch" ]]; then
  echo "watching activity_trail → live.json every 5s (Ctrl-C to stop)"
  while true; do write_once || true; sleep 5; done
else
  write_once
fi
