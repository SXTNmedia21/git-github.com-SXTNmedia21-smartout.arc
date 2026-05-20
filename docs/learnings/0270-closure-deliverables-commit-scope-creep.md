---
id: L_0270
title: Closure-deliverables commit absorbs unrelated polish work
status: accepted
layer: learning
created: 2026-05-14
updated: 2026-05-14
tags: [campaign-merge, scope-creep, contamination, closure-protocol]
---

# L-0270: Closure-deliverables commit absorbs unrelated polish work

## Context

Campaign `world-best-wfm` sub-sortie `wfm-campaign-merge-prep` produced commit `4bfc32252` titled "closure deliverables" that bundled WFM-legitimate doc files **plus** 8 unrelated `apps/web/src/app/dashboard/people/**` files that belonged to a concurrent sortie (`feat/people-page-polish-tier1`, merged independently via `cd07b86a2`). Dev had independently modified the same 8 files via `f90a89a76` (people-polish tier-1 phases 2+4-8). At PR #385 merge-time, this triggered 6 `git merge-tree` conflicts (predicted 2; actual 6 per L-0167 sibling pattern).

Resolution at merge was clean (`take dev` on people-page files), but the contamination was a silent class of risk: had dev and campaign edits semantically diverged on the same file, the merge would have silently picked one over the other depending on conflict orientation.

## Observation

When a sub-sortie's working tree is dirty with files from a parallel concurrent sortie, the typical "closure deliverables" omnibus commit pulls them in. Three operational drivers:
- Worktrees share `node_modules` via pnpm symlinks but `git status` sees ALL tracked dirty paths
- "closure deliverables" commit phrasing invites `git add -A` patterns instead of targeted `git add <file>`
- Sub-sortie agents don't always know which files belong to their topic

3rd+ occurrence in 6 weeks:
1. 2026-04-27 — journey-engine campaign sub-sortie absorbed agent-profile-system polish
2. 2026-05-10 — Botsson senior-review sortie absorbed doc-drift cleanup
3. 2026-05-14 — wfm-campaign-merge-prep absorbed people-page-polish-tier1 (this incident)

## How to apply

**Pre-commit hook for closure-prep commits:** When commit message matches `/closure (deliverables|prep)/i`, run a topic-coherence check — grep changed paths for keywords from the campaign/sortie name; warn if >20% of changed files don't match any campaign-topic keyword.

**In council Phase 2.5 fact-check:** When a campaign HANDOFF claims `ready_for_pr`, run `git show HEAD --stat | head -30` AND `git show HEAD --name-only | grep -v <topic-keywords>` to flag scope-creep files. Add to skill Phase 2.5 if 4th occurrence.

**For sub-sortie agents:** Use `git add <explicit-file-list>` not `git add -A` when writing closure-deliverables commits. Stage the working tree EXPLICITLY.

Sibling learnings: L-0167 (briefing under-counts conflicts), L-0188 (briefing-spot-checks-vs-real).

## Related

- ADR-0213 (campaign merge-commit, NOT squash) — preserved the contamination trail so post-mortem worked
- L-0167 — briefing collision counts are spot-checks
- Campaign PR: #385 `eda525f4f` (2026-05-14)
- Council session: 2026-05-14 — WFM Campaign Merge Readiness
