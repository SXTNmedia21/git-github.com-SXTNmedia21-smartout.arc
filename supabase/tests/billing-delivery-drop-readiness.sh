#!/usr/bin/env bash
# ADR-0135 grep-gate for invoice.delivery_* DROP (Fase 3A B6)
#
# Scans application source for references to the Fase 1/2 dual-write
# columns that will be DROPped in B6:
#   - invoice.delivery_channel
#   - invoice.delivery_status
#   - invoice.external_reference
#
# B6 is blocked until this script exits 0. Current behaviour (during
# Fase 3A B1-B5): the script is expected to FAIL because the columns
# still exist and callers still read them. That's the intended pre-flight
# state — running this regularly during B2-B5 is how we know when the
# DROP is safe to stage.
#
# Scope:
#   - apps/**/src      (web, mobile, landing)
#   - packages/**/src  (shared libs)
#   - supabase/functions (Edge Functions)
#   - supabase/migrations (no NEW migrations referencing these columns)
#
# Out of scope:
#   - docs/            (historical specs + ADRs may legitimately discuss)
#   - test fixtures    (tests of the drop itself may reference)
#   - Fase 2 DROP-this-in-B6 migration (the migration file itself will)
#
# Exits 0 when clean (B6 safe to stage). Exits 1 otherwise.
#
# Ref: ADR-0135.

set -euo pipefail

PATTERNS='delivery_channel|delivery_status|external_reference'
EXIT_CODE=0

echo "ADR-0135 grep-gate — scanning for $PATTERNS..."

# Use find instead of bare grep to avoid shell-glob expansion surprises.
# grep -E for extended regex. -r for recursive, -n for line numbers.
# Exclude .next, node_modules, build artefacts, test fixtures, and docs.
MATCHES=$(
  grep -rnE "$PATTERNS" \
    apps/ \
    packages/ \
    supabase/functions/ \
    supabase/migrations/ \
    2>/dev/null \
  | grep -vE '(\.next/|node_modules/|/dist/|/\.turbo/|/test/|/tests/|__tests__|\.spec\.|/docs/|/archive/)' \
  || true
)

if [ -n "$MATCHES" ]; then
  echo "FAIL: Found $(echo "$MATCHES" | wc -l) reference(s) that must be migrated before DROP:"
  echo "$MATCHES"
  EXIT_CODE=1
else
  echo "PASS: No application-code references to delivery_channel / delivery_status / external_reference."
fi

exit $EXIT_CODE
