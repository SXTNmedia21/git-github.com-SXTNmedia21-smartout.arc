#!/usr/bin/env bash
# domain-steward Stop hook — auto-learn + drift flag.
# Install: add to .claude/settings.json Stop hooks.
# On session stop: if any docs/domains/<name>/ files were touched this session,
# remind to run `domain-steward post <name>` so insight is captured and the
# dashboard ticks. Also flags mechanical junk (Zone.Identifier, stray binaries).
set -euo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DOMAINS_DIR="$REPO/docs/domains"
[ -d "$DOMAINS_DIR" ] || exit 0

# Domains touched (staged or unstaged) this session.
touched=$(cd "$REPO" && git status --porcelain -- docs/domains 2>/dev/null \
  | awk '{print $2}' | sed -n 's#^docs/domains/\([^/]*\)/.*#\1#p' | sort -u | grep -v '^_' || true)

if [ -n "$touched" ]; then
  echo "🟡 domain-steward: domain docs touched this session — run \`domain-steward post <name>\` to capture learnings + tick _DASHBOARD.md:"
  echo "$touched" | sed 's/^/   - /'
fi

# Mechanical hygiene (script's job, not skill judgment).
junk=$(find "$DOMAINS_DIR" -name '*Zone.Identifier' 2>/dev/null | wc -l | tr -d ' ')
[ "$junk" != "0" ] && echo "🧹 domain-steward: $junk Zone.Identifier file(s) under docs/domains — purge with: find docs/domains -name '*Zone.Identifier' -delete"

bins=$(find "$DOMAINS_DIR" \( -name '*.pdf' -o -name '*.png' -o -name '*.jsx' \) 2>/dev/null | wc -l | tr -d ' ')
[ "$bins" != "0" ] && echo "🧹 domain-steward: $bins binary/prototype file(s) under docs/domains — docs are text; move to assets/."

exit 0
