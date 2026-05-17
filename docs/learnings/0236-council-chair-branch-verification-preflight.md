---
title: "Council chair MUST verify branch context before Phase 3 read (6th L-0147 precedent)"
id: LEARNING_0236
status: canonical
layer: learning
created: 2026-05-12
updated: 2026-05-12
tags: [council, l-0147, chair-self-reversal, branch-context, system-steward, preflight]
---

# Learning-0233: Council chair MUST verify branch context before Phase 3 read

## Context

Day-3 payroll period_locked notification handler council session 2026-05-12. Chair (system-steward, Phase 3, opus) read `/home/sxtnl/dev/smartout.ai` (development branch) instead of `/home/sxtnl/dev/smartout.ai-payroll-wt-1` (worktree on `feat/payroll-mvp-blockers` based on `campaign/payroll`).

Campaign branch has ~231 commits of payroll-mvp work shipped that have NOT merged to development. Chair grep'd files on development and concluded:

- `tools.ts:902` emit site "does not exist" — file is 620 lines on development, no `payroll.period_locked` references
- `payroll.period_locked` "does not route to engine_event" — only `settlement period_locked` exists in development registry
- `tools.ts` "is 620 lines" — actually 2663 lines on worktree branch
- ADR-0161 entity flatten "not yet implemented" — actually LIVE at `engine-event.ts:57-63`

These false-state claims produced a Phase 3 verdict requiring 6 prerequisite blockers, most of which were already resolved on the correct branch. Phase 5 invoked Chair Self-Reversal Protocol (L-0147) — Phase 3 vote classified REVERSED with falsifying evidence from agent-coord Layer 2 trace + harness-builder grep + Phase 2.5 fact-check.

## Discovery

Council orchestrator passes briefing with file paths. When the user is working in a worktree, the briefing's file paths are worktree-relative. Chair sub-agent receives the briefing but may default to reading files at the canonical main repo path (no explicit `cwd` constraint in briefing format).

The asymmetry: Phase 2.5 fact-check sub-agent ran against the worktree path (explicit path in prompt). Chair sub-agent assumed main repo. Both were "correct" against their respective branches — but they disagreed because they read different states.

This is the **6th codified L-0147 Chair Self-Reversal precedent**:
1. Year Wheel Redesign 2026-04-20 (Trust Gate Phase 3 PASS → Phase 5 FAIL after agent-coord code-trace)
2. /dashboard/help 2026-04-28 (Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence)
3. ADR-0216 2026-04-28 (Phase 3 Option A2 → Phase 5 Option B after Supervisor 139-site blast-radius scan)
4. Botsson on Platform Admin 2026-04-29 (Phase 3 wrong-scope assumption REVERSED at Phase 5)
5. S6 R4 2026-05-09 (Phase 3 conditional approve REVERSED to APPROVE after E2E ran green)
6. **Payroll Day-3 2026-05-12** (Phase 3 wrong-branch read REVERSED at Phase 5)

Pattern signature: chair operates on incomplete scope or wrong context; reviewer code-trace expands scope; chair must reverse, not rationalize.

## Impact

**New Phase 1 INTAKE preflight rule for `system-steward` (and any chair sub-agent):**

Before any Phase 3 read, chair MUST verify branch context with:

```bash
git branch --show-current        # confirm correct branch
git log --oneline -5             # confirm campaign tip
git worktree list                # confirm worktree mapping
wc -l <file-claimed-to-be-X>     # verify size claims
ls <file-claimed-to-not-exist>   # verify file claims
```

**Briefing-format amendment for `/run-council` skill:** When user is in a worktree, briefing MUST include:
- Explicit `cwd: /absolute/worktree/path` directive
- All file paths absolute, not relative
- Branch state header: `Branch: feat/X based on campaign/Y, N commits ahead of dev`

**Default Phase 2.5 fact-check claim addition:** "Confirm the working branch matches the briefing's stated branch. If briefing names `development` but emit-site only exists on `campaign/payroll`, council premises are invalid."

## Impact on `system-steward` agent memory

Add to agent definition:

> **Verification Protocol — Step 0 (MANDATORY before any Phase 3 review):** Confirm cwd matches briefing's stated branch. Run `git branch --show-current` + `git log --oneline -5`. If the briefing says "campaign work shipped at X" but `git log` shows X not in this branch, REFUSE to vote until orchestrator supplies correct path. Don't paper over branch-context drift with hypothetical reasoning.

## References

- L-0147 — Chair Self-Reversal Protocol (codified after 3rd precedent)
- ADR-0319 — `notify_each_profile` dispatcher action_type (this session's verdict — would have been blocked if Steward Phase 3 verdict stood)
- Council log: `docs/council/COUNCIL-LOG.md` 2026-05-12 entry
- Prior precedents: 2026-04-20 (Year Wheel), 2026-04-28 (help + ADR-0216), 2026-04-29 (Botsson), 2026-05-09 (S6 R4)
