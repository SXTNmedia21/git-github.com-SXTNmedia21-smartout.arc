#!/usr/bin/env bash
# Stop-hook: appends contract-e2e orchestration tail to project memory.
# Triggers on every session Stop. Idempotent — appends only the latest cycle entries.
# Memory file is loaded into MEMORY.md index for future sessions.

set -uo pipefail

ORCH_FILE="/home/sxtnl/dev/smartout.ai/docs/orchestration/CONTRACT-E2E-2026-04-30.md"
MEM_DIR="/home/sxtnl/.claude/projects/-home-sxtnl-dev-smartout-ai/memory"
MEM_FILE="$MEM_DIR/orchestration_contract_e2e.md"
MEM_INDEX="$MEM_DIR/MEMORY.md"
LOG_FILE="/home/sxtnl/dev/second-brain-v2/ops/activity-log.md"

# Bail quietly if orch file doesn't exist (other sessions don't need this hook)
[[ -f "$ORCH_FILE" ]] || exit 0

mkdir -p "$MEM_DIR"

# Initialize memory file with frontmatter if absent
if [[ ! -f "$MEM_FILE" ]]; then
  cat > "$MEM_FILE" <<'EOF'
---
name: Contract E2E Orchestration
description: Repetitive-loop orchestration log for ansatt-kontrakt end-to-end work. Updated on every session Stop. Source of truth for cycle scores, learnings, and next-slice decisions.
type: project
---

# Contract E2E Orchestration — Cross-Session Memory

This file is auto-written by `.claude/hooks/contract-e2e-memory-write.sh` on every session Stop.

Pulls the tail of `docs/orchestration/CONTRACT-E2E-2026-04-30.md` so the next session inherits cycle history without rereading the full plan.

EOF
fi

# Snapshot timestamp + last 80 lines of orch file (covers most recent cycle)
{
  echo ""
  echo "## Snapshot $(date -Iseconds)"
  echo ""
  tail -n 80 "$ORCH_FILE"
  echo ""
  echo "---"
} >> "$MEM_FILE"

# Register pointer in MEMORY.md index if not already present
if [[ -f "$MEM_INDEX" ]]; then
  if ! grep -q "orchestration_contract_e2e.md" "$MEM_INDEX"; then
    echo "- [Contract E2E Orchestration](orchestration_contract_e2e.md) — repetitive-loop log for ansatt-kontrakt E2E, updated on session Stop" >> "$MEM_INDEX"
  fi
fi

# Activity-log entry (per CLAUDE.md mandate)
if [[ -f "$LOG_FILE" ]]; then
  {
    echo ""
    echo "## [$(date -Iseconds)] source:system | actor:claude"
    echo "Contract-e2e orchestration memory snapshot written to $MEM_FILE (Stop-hook)"
  } >> "$LOG_FILE"
fi

exit 0
