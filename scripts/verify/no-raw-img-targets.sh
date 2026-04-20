#!/usr/bin/env bash
# Assert PR3a target paths have no raw <img> tags.
# GiveSlide.tsx is exempt — uses injected ImageComponent prop pattern.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

TARGETS=(
  "apps/web/src/app/public-site"
  "apps/web/src/app/onboarding/steps/ConfirmBusiness.tsx"
)

HITS=""
for t in "${TARGETS[@]}"; do
  FOUND="$(grep -rnE '<img[^a-zA-Z]' "$t" --include='*.tsx' 2>/dev/null || true)"
  if [[ -n "$FOUND" ]]; then
    HITS+="$FOUND\n"
  fi
done

if [[ -n "$HITS" ]]; then
  echo "FAIL: raw <img> found in PR3a target paths:"
  echo -e "$HITS"
  exit 1
fi

echo "PASS: PR3a target paths have no raw <img> (GiveSlide exempt — injected ImageComponent prop)."
