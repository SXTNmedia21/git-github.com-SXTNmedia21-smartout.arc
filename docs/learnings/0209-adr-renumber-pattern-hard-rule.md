---
title: "ADR Renumber Pattern — 5th occurrence → hard rule (git log --all before allocating)"
id: LEARNING_0209
status: canonical
layer: learning
created: 2026-05-05
updated: 2026-05-05
tags: [adr, renumber, council-phase-8, multi-branch, hard-rule]
---

# Learning-0209: ADR Renumber Pattern — 5th occurrence promotes to hard rule

## Context

Pipeline Consolidation Plan Council 2026-05-04 identified ADR-0266 collision risk. Bubble-migration HANDOFF (2026-05-03, memory `project_bubble_migration_campaign_2026_05_03`) explicitly claims ADRs 0266-0268. Billing-erik-seed (memory `council_meta`, 2026-05-04) claims ADR-0269. CI-incident-response (memory `feedback_ci_domain_full_autonomy`, 2026-05-04) claims ADR-0275. Verified via `git log --all`:

```
0269-accountant-portal-data-foundation.md
0270-business-intelligence-capability-godmode.md  ← collision
0270-mobile-shift-authoring-via-bff.md            ← collision
0271-booking-create-stack.md                      ← collision
0271-multi-criteria-exit-criteria.md              ← collision
0271-task-mobile-bff-wrap.md                      ← collision
0272-mission-template-registry.md                 ← collision
0272-task-mobile-bff-wrap.md                      ← collision
0273-deviation-day-info-server-action-migration.md
0273-two-brain-emit-pattern.md                    ← collision
0275-ci-incident-response-agent.md
0275-voice-plane-consolidation-livekit-only.md    ← collision
```

5+ filename collisions in 0270-0275 range alone. Multiple branches independently allocated same numbers because none ran `git log --all` before claiming.

## Prior occurrences (4)

Per memory `reference_adr_renumber_pattern.md`:
1. 2026-04-19 kanaler council — 0156-0159 → 0160-0163
2. 2026-04-29 contracts — 0233-0236 → 0241-0244
3. 2026-05-02 lovsen — 0242-0245 → 0256-0259
4. 2026-05-02 payroll — 0228-0229 → 0260-0261

This (2026-05-04 pipeline-consolidation council) = **5th occurrence**.

## Promotion to hard rule

Per Council Skill Phase 8 Step 0 (added 2026-04-19 after kanaler renumber): single-occurrence patterns are noise-as-policy. 3rd occurrence = pattern. 5th occurrence with documented mid-session renumbers + cross-branch collision filenames on disk = **hard rule**.

### Mandatory before any ADR allocation:

```bash
# Multi-branch reservation check (mandatory)
git log --all --oneline -- 'docs/decisions/[0-9]*-*.md' | head -30
git log --all --name-only | grep -E 'docs/decisions/[0-9]{4}-' | sort -u | tail -20

# Stash check (added 2026-05-04 per L-0206 stashed-ADR pattern)
git stash list | grep -i 'adr\|decision' || true
```

Pick number STRICTLY greater than highest observed across ALL branches AND all stashes. Cost of check: 30 seconds. Cost of collision: 15-30 minutes per occurrence × 5 occurrences = 75-150 minutes lost.

### Sed-replace bulk-rename trap (added 2026-05-02 lovsen + payroll)

`s/ADR_0238/ADR_0256/g` over-matched dev-owned ADRs that legitimately had `id: ADR_0238`. Always check `git status` after sed; revert false-positive M's. Always run `git log --all --oneline | grep -i "renumber"` before claiming "ADR-X does not exist".

## Action items (already in skill)

- Council Phase 1 INTAKE: run `git log --all` reservation check (was Phase 8 Step 0; promote to Phase 1)
- Council Phase 8 Step 0: re-verify against `git log --all` AND `git stash list`
- Plan-author obligation: every plan referencing an ADR slot includes "verified free against `git log --all` at <commit-sha>"

## Related

- L-0042 (parallel-worktree migration timestamps — same root cause class)
- L-0206 (stashed-ADR pattern — orthogonal but compounds: must check stash + git log)
- ADR-0265 (deployment pipeline — operator-only invariant violated when agent assumes ADR slot is free)
- Memory: `reference_adr_renumber_pattern.md` (4 prior occurrences logged)

## Why this matters

ADR allocation is load-bearing. An ADR with the wrong number gets cherry-picked into the wrong place, references break, decision-log entries duplicate, sed-rename clobbers other ADRs. Every council session that allocates ADRs without `git log --all` is rolling dice on collision. After 5 occurrences the dice are loaded — assume collision until proven free.
