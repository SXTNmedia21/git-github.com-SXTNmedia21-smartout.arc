---
title: "ADR-0112 intent-enum lag — 5th recurrence promotes to mandatory pre-flight gate"
id: LEARNING_0306
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [adr-0112, intent-classifier, capability-registration, pre-flight, recurring-blocker]
---

# Learning-0306: ADR-0112 intent-enum lag — 5th recurrence promotes to mandatory pre-flight gate

## Context

During Council Phase 5 synthesis on ADR-0367 (Day Line Area-Anchored Runtime, 2026-05-18), system-agent-coordinator flagged that the proposed Phase B capability registration (3 new capabilities under `day-line/` + `routine/` + `org/`) would block `close-feature.sh` push unless `intent-classifier.ts` enum + system-prompt prose ship in the same commit. This is the 5th observed occurrence of the pattern documented in `learning_adr_0112_intent_enum_lag.md` (welcome-mission inquiry, outreach, sortie_closure_blockers, cascade delegation tools).

## Discovery

The ADR-0112 trap is structural: capability registration in `packages/ai/src/capabilities/registry.ts` succeeds at TypeScript level, but `packages/ai/scripts/check-intent-coverage.ts` runs at `close-feature.sh` time and fails when a registered capability lacks an entry in `packages/ai/src/router/intent-classifier.ts:38-79` enum + corresponding prose at `:155-192`. The fix is 2-line mechanical (enum entry + prose paragraph) but discovery happens late, at push time, after builder agents have moved on.

Delegation-only capabilities (e.g. `cascade` per ADR-0356) still need enum entry with explicit "DELEGATION-ONLY, classifier should never pick" prose pointing to user-routable siblings. The `DOCUMENTED_TOOLLESS` allow-list in `check-intent-coverage.ts:51-57` accepts this pattern.

## Impact

5th occurrence meets the promotion threshold per the run-council skill self-improvement Phase 9 step 4: pattern promoted into SKILL.md as mandatory pre-flight gate.

**Hard rule for future capability sortier:**

Before any sortie that registers a new capability under `packages/ai/src/capabilities/<name>/`, the PRE-FLIGHT checklist MUST include:

1. Grep `packages/ai/src/router/intent-classifier.ts:38-79` — confirm entry for new capability namespace
2. Grep `packages/ai/src/router/intent-classifier.ts:155-192` — confirm prose paragraph with disambiguation from sibling capabilities
3. For delegation-only capabilities: confirm entry in `DOCUMENTED_TOOLLESS` allow-list at `check-intent-coverage.ts:51` with `"DELEGATION-ONLY"` comment
4. Run `pnpm --filter @smartout/ai test:intent-coverage` locally before push

For ADR-0367 specifically: Phase B sortie MUST land enum entries for `day-line`, `routine`, `org` capability namespaces in the same commit as the capability code. Without this, Phase B close-feature is blocked and the sortie ships a non-merge-able artifact.

## References

- ADR-0112: capability registration discipline
- ADR-0367: Day Line Area-Anchored Runtime (Phase B introduces 3 new capabilities)
- `learning_adr_0112_intent_enum_lag.md` (project memory — prior 4 occurrences)
- `packages/ai/src/router/intent-classifier.ts:38-200`
- `packages/ai/scripts/check-intent-coverage.ts:51-302`
