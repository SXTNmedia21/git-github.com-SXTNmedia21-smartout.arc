#!/usr/bin/env bash
# Assert the dashboard _hooks barrel is gone and no file imports from it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

BARREL="apps/web/src/app/dashboard/_hooks/index.ts"
if [[ -f "$BARREL" ]]; then
  echo "FAIL: barrel file still exists at $BARREL"
  exit 1
fi

HITS="$(grep -r --include='*.ts' --include='*.tsx' \
  -lE "from ['\"]@/app/dashboard/_hooks['\"]" \
  apps/web/src || true)"

if [[ -n "$HITS" ]]; then
  echo "FAIL: files still import from the deleted barrel:"
  echo "$HITS"
  exit 1
fi

echo "PASS: barrel deleted, no dangling imports."
