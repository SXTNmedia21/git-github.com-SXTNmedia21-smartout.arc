---
id: L-0350
title: Briefing tool-count off-by-one — schedule capability has 7 tools, not 6
status: published
date: 2026-05-25
related: [L-0344 (BUGS.md ghost-claim), Phase 2.5 fact-check rule]
tags: [briefing-discipline, council, schedule-capability, off-by-one]
---

# L-0350 — Briefing tool-count off-by-one

## What happened

Council 2026-05-25 briefing claimed `packages/ai/src/capabilities/schedule/` has 6 read-only tools. Code-tracer (supervisor + system-agent-coordinator) both flagged: **7 tools, not 6**.

The miss: `getShiftLifecycle` lives in `packages/ai/src/capabilities/schedule/tools/get-shift-lifecycle.ts` (separate file from flat `tools.ts`). My grep in the pre-brief research used `grep -c "name:.*\"" packages/ai/src/capabilities/schedule/tools.ts` → returned 6, missing the dir-style outlier.

Brief was off by one. Read-only posture claim was correct.

## Why it matters

The 7th tool (`get_shift_lifecycle`) is the read-side counterpart for ADR-0095 5-layer lifecycle. If a council reasons about read coverage and brief says "6 reads only", reviewers may propose a NEW lifecycle-read tool that already exists — duplicate-work risk.

Sibling of L-0344 (BUGS.md ghost-claim) — both are "briefing precision degrades when grep covers only the obvious file".

## Class

**Single-file grep blind spot.** Capability dir-style + flat-style mixed in same capability (schedule uses `tools.ts` PLUS one outlier file `tools/get-shift-lifecycle.ts`). `grep packages/ai/src/capabilities/schedule/tools.ts` misses the dir-style file.

## Fix

Brief regen rule: when counting capability tools, use:
```bash
grep -rn "^export const \w\+Tool\|^export const \w\+ = defineTool\|name: \"\w" packages/ai/src/capabilities/<name>/ 2>/dev/null | grep -c "name: \""
```
OR open `packages/ai/src/capabilities/<name>/index.ts` directly — `tools = [...]` array is canonical source.

## Prevention rule

Phase 2.5 briefing fact-check (already enforces file:line precision per L-0297, schema-vs-code per L-0348): add tool-count cross-check against `<capability>/index.ts` `tools` array length. Discrepancy = false count.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/capabilities/schedule/index.ts:5-13,18-28` (7-entry tools array)
- `packages/ai/src/capabilities/schedule/tools/get-shift-lifecycle.ts` (the missed file)
