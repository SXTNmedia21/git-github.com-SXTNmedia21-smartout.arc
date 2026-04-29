---
title: "HANDOFF Location Convention — docs/handoffs/ canonical, depth-2"
id: ADR_0237
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0237: HANDOFF Location Convention — `docs/handoffs/` Canonical (Depth-2)

## Context and Problem Statement

Council post-implementation review of campaign/core-module merge 2026-04-29 surfaced a script-vs-convention drift:

- 4 of 5 sub-sortie HANDOFFs landed at `docs/handoffs/HANDOFF-<feature>.md` (depth-2)
- 1 sub-sortie HANDOFF (`HANDOFF-m2-thread-continuation.md`) landed at `docs/HANDOFF-<feature>.md` (depth-1)
- `~/.claude/scripts/close-feature.sh:273` did `find docs -maxdepth 1 -name "HANDOFF-${FEATURE_NAME}.md"` — only checks depth-1
- Result: 3 of 4 sub-sorties (M2.2, M2.3, M3.2) would have failed the close-feature.sh handoff gate had it run; gate was passing because the warnings were treated as non-fatal

7+ historical handoffs already exist in `docs/handoffs/` going back to 2026-03 work. The convention is established by usage, not by script.

## Decision Drivers

- 4-of-5 convention from sub-sorties matches all pre-2026-04 handoffs
- `docs/handoffs/` directory provides better discoverability (one folder = all closure artefacts)
- Script gate must catch missing handoffs reliably; depth-1-only check creates false negatives
- `/close-feature.md` skill spec already references `docs/handoffs/HANDOFF-<feature>.md` path

## Considered Options

1. **Move all to depth-1** — relocate 7+ historical files; aligns with current script. Rejected: invasive, breaks existing links, fights established convention.
2. **Depth-2 canonical + script patch** — keep `docs/handoffs/`, widen script `find -maxdepth 2`. Accepted: aligns code with reality, no historical relocation.
3. **Allow both** — let either path satisfy the gate. Rejected: ambiguity, doesn't enforce a canonical location, future drift inevitable.

## Decision

**Option 2.** `docs/handoffs/HANDOFF-<feature>.md` is canonical. Script `~/.claude/scripts/close-feature.sh:273` patched to `find docs -maxdepth 2 -name "HANDOFF-${FEATURE_NAME}.md"`. Outlier file (`HANDOFF-m2-thread-continuation.md`) moved into `docs/handoffs/` 2026-04-29.

## Consequences

- All future sub-sortie HANDOFFs land at `docs/handoffs/HANDOFF-<feature>.md`
- `close-feature.sh` correctly catches missing handoffs without false-positive misses
- Existing depth-1 documents (HANDOFF-b2-season, HANDOFF-c1-mobile-voice etc., 30+ files) remain at depth-1 — they are pre-convention and not worth bulk-relocation now. Future work that touches them migrates one-at-a-time.
- `/start-feature` skill template paths unchanged (already points to `docs/handoffs/`).

## Cross-references

- Council 2026-04-29 (post-implementation campaign/core-module review)
- Supervisor finding 8 (close-feature.sh maxdepth drift)
- Steward Phase 5 chair self-reversal
- `~/.claude/scripts/close-feature.sh` (patched 2026-04-29)
