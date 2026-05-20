#!/usr/bin/env bash
# Edge Functions Boot Check
#
# POSTs an empty JSON payload to every function in supabase/functions/.
# Classifies each response:
#   - BOOT OK   → 200/400/401/403/404/422 (function booted, validation/auth/notfound)
#   - BOOT FAIL → 503/500 with "BOOT_ERROR" or InvalidWorkerCreation
#   - UNKNOWN   → other status (5xx without boot-error marker)
#
# This is a boot-sanity gate. It does NOT verify business logic. A 400 means
# the function loaded, parsed the request, and rejected the payload — exactly
# what we want to see for empty-body smoke.
#
# Usage:
#   ./infra/scripts/edge-functions-boot-check.sh                    # default: local
#   SUPABASE_URL=https://xxx.supabase.co ./infra/scripts/...         # remote
#   ./infra/scripts/edge-functions-boot-check.sh --verbose           # show all responses

set -euo pipefail

SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}"
FUNCTIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../supabase/functions" && pwd)"
VERBOSE=0
TIMEOUT=8

for arg in "$@"; do
  case "$arg" in
    --verbose|-v) VERBOSE=1 ;;
    --timeout=*) TIMEOUT="${arg#*=}" ;;
  esac
done

# ANSI colors
G="\033[0;32m"; R="\033[0;31m"; Y="\033[0;33m"; D="\033[2m"; N="\033[0m"

# Discover function dirs (skip _shared, files, config)
mapfile -t FUNCS < <(
  find "$FUNCTIONS_DIR" -mindepth 1 -maxdepth 1 -type d \
    | xargs -I{} basename {} \
    | grep -v "^_" \
    | sort
)

echo "Edge Functions Boot Check"
echo "  target: ${SUPABASE_URL}"
echo "  count:  ${#FUNCS[@]}"
echo ""

OK=0; FAIL=0; UNKNOWN=0
FAIL_NAMES=()
UNKNOWN_NAMES=()

for fn in "${FUNCS[@]}"; do
  # Skip functions that require special methods (webhook signature, etc.)
  # by ignoring known non-POST endpoints. Still attempts POST as boot test.
  url="${SUPABASE_URL}/functions/v1/${fn}"

  resp_file="$(mktemp)"
  status=$(curl -s -o "$resp_file" -w "%{http_code}" \
    --max-time "$TIMEOUT" \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SUPABASE_ANON_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -d '{}' 2>/dev/null || echo "000")

  body=$(cat "$resp_file" 2>/dev/null || echo "")
  rm -f "$resp_file"

  # Classification
  case "$status" in
    200|201|204|400|401|403|404|405|409|422)
      OK=$((OK+1))
      [[ $VERBOSE -eq 1 ]] && printf "  ${G}✓${N} ${D}%-3s${N} %s\n" "$status" "$fn"
      ;;
    503|500)
      if echo "$body" | grep -qE "BOOT_ERROR|InvalidWorkerCreation|InvalidWorkerResponse|WORKER_ERROR|failed to bootstrap|failed to determine entrypoint"; then
        FAIL=$((FAIL+1))
        FAIL_NAMES+=("$fn")
        printf "  ${R}✗${N} %-3s BOOT_FAIL  %s\n" "$status" "$fn"
        [[ $VERBOSE -eq 1 ]] && echo "       body: $body"
      else
        UNKNOWN=$((UNKNOWN+1))
        UNKNOWN_NAMES+=("$fn")
        printf "  ${Y}?${N} %-3s          %s\n" "$status" "$fn"
        [[ $VERBOSE -eq 1 ]] && echo "       body: $body"
      fi
      ;;
    000)
      UNKNOWN=$((UNKNOWN+1))
      UNKNOWN_NAMES+=("$fn")
      printf "  ${Y}?${N} %-3s TIMEOUT    %s\n" "$status" "$fn"
      ;;
    *)
      UNKNOWN=$((UNKNOWN+1))
      UNKNOWN_NAMES+=("$fn")
      printf "  ${Y}?${N} %-3s          %s\n" "$status" "$fn"
      [[ $VERBOSE -eq 1 ]] && echo "       body: $body"
      ;;
  esac
done

echo ""
echo "─────────────────────────────────────"
printf "  ${G}OK:${N}      %d\n" "$OK"
printf "  ${R}FAIL:${N}    %d\n" "$FAIL"
printf "  ${Y}UNKNOWN:${N} %d\n" "$UNKNOWN"
echo "─────────────────────────────────────"

if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Boot failures (need investigation):"
  for n in "${FAIL_NAMES[@]}"; do echo "  - $n"; done
fi

if [[ $UNKNOWN -gt 0 && $VERBOSE -eq 0 ]]; then
  echo ""
  echo "Unknown status (re-run with --verbose for body):"
  for n in "${UNKNOWN_NAMES[@]}"; do echo "  - $n"; done
fi

# Exit non-zero only on confirmed boot failures
[[ $FAIL -eq 0 ]] || exit 1
