---
title: "Frontend-Designer Hallucinates File Absence Without Read Verification"
id: LEARNING_0170
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [council, agent-reliability, hallucination, fact-check, frontend-designer]
---

# Learning 0170: Frontend-Designer Claims Files Don't Exist — Without Reading

## Observation

Council 2026-04-29 post-implementation review of `/dashboard/help` UI dispatched frontend-designer with explicit pre-loaded path list of 7 files to read. Agent returned:

> "VERDICT: CANNOT AUDIT — FILES DO NOT EXIST"
>
> "Based on the git status shown at the start of the conversation, there is no `/dashboard/help` directory listed in modified or untracked files... the campaign milestones described (M1, M2.1, M2.2, M3.2) have not been committed to the `development` branch as of the conversation start."

Orchestrator verified via direct `ls`:

```bash
ls apps/web/src/app/dashboard/help/page.tsx
apps/web/src/app/dashboard/help/_components/PanicBar.tsx
apps/web/src/app/dashboard/help/_components/ActiveTicketBadge.tsx
apps/web/src/app/dashboard/help/_components/TourHighlight.tsx
apps/web/src/app/dashboard/help/_components/TakeoverPreview.tsx
apps/web/src/app/dashboard/help/loading.tsx
```

All 6 files PRESENT. Frontend-designer hallucinated absence based on **inferred state from git status output** instead of using Read tool. Burned 99 seconds + 48k tokens producing a false negative that would have blocked council closure.

## Root Cause

Frontend-designer agent was assembled with PR/diff-oriented skill bundle. When briefed without git-diff context, it falls back to git-status inference rather than Read. Pattern signature:

1. Agent sees git status with NO entries in target directory (only modified files elsewhere)
2. Agent reasons: "no entries → directory doesn't exist on this branch"
3. Agent skips Read entirely
4. Agent returns "files don't exist" verdict with confident framing

The error is NOT in the Read tool's reliability — it's in the agent never invoking it. Skill bundle bias (PR-oriented → git-status-as-truth) overrides the briefing's explicit path list.

## What This Means

Council reviewers given pre-loaded paths must be enforced via prompt structure to actually Read those paths. Pre-loading paths in briefing isn't enough — agent needs explicit "Read the 7 files listed BEFORE forming any verdict."

## Apply Going Forward

1. **Run-council briefing template:** for any agent receiving pre-loaded file list, add explicit instruction: *"You MUST Read each listed file before any verdict. Do not infer file presence/absence from git status, conversation history, or other agents' summaries."*
2. **Phase 3 error recovery:** if agent returns "files don't exist" or "cannot audit", orchestrator MUST verify via direct `ls` before accepting DEGRADED-MODE. False negatives are not acceptable degradation.
3. **Frontend-designer specifically:** prefer pre-fetched file contents pasted into briefing over path-list-only briefings. Meta-memory 2026-04-13 noted: "Frontend Designer cannot reliably read files itself." The path-list-only experiment 2026-04-29 reconfirmed.
4. **Fallback policy:** if frontend-designer fails twice on same dispatch (initial + re-dispatch), orchestrator does inline visual review using its own Read tool. Don't delegate something the agent can't perform reliably.

## Pattern Tracker

| Date | Council | Failure mode |
|---|---|---|
| 2026-04-13 (meta-memory) | original | "Frontend Designer cannot reliably read files itself" — inferred missing |
| 2026-04-29 | campaign/core-module post-impl | Hallucinated 6 files absent from path-list briefing despite files present on `development` HEAD |

**2nd occurrence — at 3rd, promote frontend-designer briefing rule to `run-council` SKILL.md hard rule.**

## Cross-references

- Council 2026-04-29 (post-implementation campaign/core-module review)
- L-0094 phantom emit pattern (related — confident claims about absence)
- L-0124 phantom body pattern
- L-0146 phantom consumer pattern (4-shape phantom-contract family)
- L-0149 phantom Q&A pattern
- meta-memory `council_meta.md` 2026-04-13 entry on frontend-designer file-read reliability
