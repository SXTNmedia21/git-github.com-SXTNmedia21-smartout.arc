---
title: "Stashed-ADR pattern — chair Phase 0 must verify on-disk before reviewing claims that cite them"
id: LEARNING_0206
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [council, adr, git-stash, fact-check, governance]
---

# Learning-0206: Stashed-ADR pattern — files not on disk break council protocol

## Context

Welcome Mission V0 council 2026-05-04. Briefing claimed 4 ADR drafts (0271-0274) produced by botsson-harness-builder. Phase 2.5 fact-check + supervisor + harness all reported: **files do not exist on disk** in `docs/decisions/`.

Recovery: `git stash@{0}: pre-promote drafts 4 (mission-engine ADRs recurr)` — files were stashed, not committed. Three previous occurrences of the same pattern observable:

1. PR #305 review 2026-05-01 — drafts in stash, not committed
2. Bubble migration 2026-05-03 — drafts intermixed in untracked + stash-state
3. **Welcome Mission 2026-05-04** — botsson-harness-builder produced ADRs in `~/dev/smartout.ai-botsson-arena/`, copied to main repo as untracked, then stashed by some workflow before review

## Discovery

**The pattern:**

- Author writes spec + ADRs in worktree A (campaign or sortie)
- Spec is copied/imported to main repo as untracked
- A workflow (lint-staged backup, pre-promote stash, manual cleanup) stashes uncommitted changes
- Council briefing references files that ARE in stash but NOT on disk
- Reviewers fail to find the files; some flag as hallucination, others assume hallucination

**Why it confuses council:**

- Phase 2.5 fact-check (general-purpose haiku) reports "files don't exist" — correct but incomplete (they exist in stash)
- Supervisor reports "Phase 0 fact-check claim verified false" — accurate
- Steward Phase 3 may not run `git stash list` and assumes Phase 2.5 is canonical
- Phase 5 synthesis is then forced to either (a) re-reference reviewer findings without grounding, or (b) explicitly find the stash and recover

**Critical timing:** the stash recovery must happen BEFORE Phase 5 synthesis OR explicitly be deferred to the user's Phase 6 confirm step.

## Impact

**Promote to Council Phase 0 hard rule:**

1. **Chair Phase 1 INTAKE must verify ADR file existence:**
   ```bash
   git ls-files docs/decisions/<adr-number>-* 2>/dev/null && echo "ON DISK" || echo "MISSING"
   git stash list | grep -i "<feature-keyword>" && echo "CHECK STASH"
   ```

2. **If stashed:** orchestrator pops the stash BEFORE Phase 2 briefing — files must be at the cited paths when reviewers read.

3. **If not on disk and not in stash:** chair flags as Phase 1 prerequisite blocker. Council does NOT proceed until author surfaces the files (commit, copy, or explicit "drafts in flight, here is link to worktree").

4. **Phase 6 user confirm includes stash-state report:** "ADR files were [committed | popped from stash | still in stash awaiting your action]." Pontus should never be surprised at Phase 8 that filer trenger commit.

## Recovery action for current session

`git stash pop` ran before Phase 7 doc-update. Files now untracked at:
- `docs/decisions/0271-multi-criteria-exit-criteria.md`
- `docs/decisions/0272-mission-template-registry.md`
- `docs/decisions/0273-two-brain-emit-pattern.md`
- `docs/decisions/0274-mission-run-contract.md`
- `docs/engines/artificial-intelligence/mission-engine/IMPLEMENTATION_SPEC_welcome_mission_v0.md`

These commit as `proposed` (not `accepted`) in this council's Phase 8 capture.

## References

- L-0098: Same-session staleness pattern
- L-0181 (proposed): Phantom-tool pattern (related — both surface as "files don't exist" but root causes differ)
- `~/.claude/skills/run-council/SKILL.md` Phase 1 INTAKE (proposed update)
- Council session 2026-05-04 Welcome Mission V0
