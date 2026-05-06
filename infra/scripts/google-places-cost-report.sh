#!/usr/bin/env bash
# ============================================
# google-places-cost-report.sh — Phase 5 cost-cap reporter
#
# Hits https://scrape.smartout.ai/places-cost?days=N and prints a one-line
# summary suitable for heartbeat / Telegram. Exits 1 when alert threshold
# (80% of $200/mo Maps Platform free tier) is crossed.
#
# Usage:
#   ./infra/scripts/google-places-cost-report.sh [days]
#
# Defaults: days=30
#
# Called by:
#   - heartbeat job `google-places-quota-check` (24h cooldown)
#   - manual Pontus triage during onboarding-spike investigation
#
# Auth: requires SCRAPLING_AUTH_TOKEN (loaded via op run).
# ============================================
set -uo pipefail

DAYS="${1:-30}"
ENDPOINT="https://scrape.smartout.ai/places-cost?days=${DAYS}"

if [ -z "${SCRAPLING_AUTH_TOKEN:-}" ]; then
  echo "ERROR: SCRAPLING_AUTH_TOKEN not set — run via 'op run --env-file=.env.template -- $0'" >&2
  exit 2
fi

response="$(curl -fsS \
  -H "Authorization: Bearer ${SCRAPLING_AUTH_TOKEN}" \
  "${ENDPOINT}" 2>&1)" || {
  echo "ERROR: curl failed: ${response}" >&2
  exit 3
}

# Parse response with jq if available, else grep + sed
if command -v jq >/dev/null 2>&1; then
  total_cost="$(echo "${response}" | jq -r '.total_cost_usd')"
  pct="$(echo "${response}" | jq -r '.free_tier_pct')"
  alert="$(echo "${response}" | jq -r '.alert_active')"
  google_calls="$(echo "${response}" | jq -r '.google.calls')"
  serper_calls="$(echo "${response}" | jq -r '.serper.calls')"
  search_calls="$(echo "${response}" | jq -r '.google.by_endpoint.search')"
  details_calls="$(echo "${response}" | jq -r '.google.by_endpoint.details')"
else
  total_cost="$(echo "${response}" | grep -oE '"total_cost_usd"[: ]+[0-9.]+' | grep -oE '[0-9.]+' | head -1)"
  pct="$(echo "${response}" | grep -oE '"free_tier_pct"[: ]+[0-9.]+' | grep -oE '[0-9.]+' | head -1)"
  alert="$(echo "${response}" | grep -oE '"alert_active"[: ]+(true|false)' | grep -oE '(true|false)' | head -1)"
  google_calls="?"
  serper_calls="?"
  search_calls="?"
  details_calls="?"
fi

summary="Google Places cost — last ${DAYS}d: \$${total_cost} (${pct}% of free tier). \
google=${google_calls} calls (search=${search_calls} details=${details_calls}), \
serper=${serper_calls} calls."

if [ "${alert}" = "true" ]; then
  echo "ALERT: ${summary}"
  exit 1
fi

echo "OK: ${summary}"
exit 0
