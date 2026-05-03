---
title: "Squash-merge erodes ADR falsifiability for multi-phase work"
id: LEARNING_0142
status: canonical
layer: learning
created: 2026-04-27
updated: 2026-04-27
tags: [git, adr, falsifiability, council, campaigns, merge-strategy]
---

# Learning-0142: Squash-merge erodes ADR falsifiability for multi-phase work

## Context

Council 2026-04-27 reviewed campaign-PR merge strategy after `campaign/year-wheel` showed 3538 commits "ahead" of `origin/development` and `campaign/journey-engine` had required two manual `git reset --hard` + cherry-pick recoveries (2026-04-22, 2026-04-23). The reviewer trace surfaced that the divergence is not just visualization noise — ADR-0202 cites M5.6 commit SHAs that no longer exist on `development` post-squash. The council issued ADR-0213 to switch campaign-PRs to merge-commit.

The deeper insight: the divergence problem and the ADR problem are the same problem.

## Discovery

When a long-lived branch hosting multi-phase work merges via squash, every internal SHA collapses. Subsequent ADRs / learnings / handoffs / status claims that cite implementation commits become un-grep-able on `development`. ADR-0196's "falsifiable status claims" discipline mandates verifiable claims (grep / SQL / test). The grep returns zero hits — but the implementation IS on the working branch, just under a different SHA.

This is a class equivalent to **L-0094 phantom-emit-contracts**. The contract reads true; the verification fails silently. With squash, the falsifiability machinery returns false-negatives because temporal granularity has been deleted. The IMPLEMENTATION exists; the CITATION evaporates.

Three observed instances on `smartout.ai`:

1. **ADR-0202** (`season-server-action-capability-namespace`): cites campaign/year-wheel M5.6 doc-hygiene sortie SHAs. Post-squash via PR #249, those SHAs don't resolve on `development`.
2. **`campaign/journey-engine` recovery 2x** (2026-04-22, 2026-04-23): each post-squash, `/sync-campaign` produced add/add conflicts because campaign's pre-squash commits are unreachable from the new development tip.
3. **`campaign/year-wheel` 3538 ahead-of-dev**: the work IS on dev (verified via `git log --first-parent` should show squash-merge commits absorbing the milestones), but the campaign branch's per-milestone commits are dangling objects from `development`'s perspective.

The pattern is not isolated to one campaign. Pre-ADR-0213, recent campaign-PRs were dominant-but-not-universal squash: PR #234 (contract-hub-redesign) squash, PR #261 (helpdesk Nordic Split) squash, PR #259 (year-wheel M5 cleanup) merge-commit (2 parents — partial precedent for the new policy).

## Impact

- ADR-0213 codifies merge-commit for `campaign/* → development` PRs going forward.
- Any branch hosting commits whose individual SHAs are referenced in `docs/` must merge-commit, not squash. Specifically: all `campaign/*` branches.
- Conversely: short-lived sortie branches (`feat/* → development`) where no internal phase structure needs preservation MAY squash. The trigger is "do any of these commits get cited?" not "how many commits?"
- Council Phase 2.5 fact-check protocol gains: "for any 'pattern is everywhere' claim, search for one counter-example before passing it forward" (paired with L-0143).
- Recovery via `git reset --hard + cherry-pick + push --force-with-lease` (per memory `reference_squash_merge_recovery.md`) becomes obsolete prospectively. Branch protection on `campaign/*` blocks force-push entirely.

### Recognition signals (when to require merge-commit)

1. Branch hosts multi-phase work with internal milestone or sortie commits (M1, M2, M3 or SS-1, SS-2, SS-3)
2. ADRs / learnings / handoffs cite specific commit SHAs from this branch
3. Branch is long-lived (>2 weeks) — sub-sorties spawn off it; collisions on reset hurt
4. Council reviews depend on sortie-granularity audit trail

If any of (1)–(4) holds: **merge-commit, never squash**.

## References

- ADR-0213 — Campaign-PRs use merge-commit, not squash
- ADR-0196 — Falsifiable status claims (the discipline this learning protects)
- ADR-0202 — Concrete example of M-stage SHA citation that breaks under squash
- L-0094 — Phantom-emit contracts (same falsifiability-bypass class)
- L-0143 — Pattern claims should be quantified, not generalized (Phase 2.5 catch this council)
- Memory `reference_squash_merge_recovery.md` — recovery doc, superseded by ADR-0213
- Council 2026-04-27

---

> Registered in `docs/learnings/0000-learning-log.md`.
