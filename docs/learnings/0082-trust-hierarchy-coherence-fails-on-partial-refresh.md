---
title: "Trust-hierarchy coherence fails when lower-tier docs refresh without upper-tier sync"
id: LEARNING_0082
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [docs, trust-hierarchy, orientation, state-summary, maintenance]
---

# Learning-0082: Trust-hierarchy coherence fails when lower-tier docs refresh without upper-tier sync

## Context

Today's STATE-SUMMARY refresh (commit `d5b88e12`) corrected ADR count (87→163), Learning count (33→82), deleted a false "wt-4 billing-engine-fase-1 in-progress" claim, and five other stale assertions. But the refresh stopped at STATE-SUMMARY: `docs/INDEX.md` still read "74 ADRs (0001–0074, no gaps)", root `CLAUDE.md` still read "54 ADRs in docs/decisions/", and `docs/ORIENTATION.md` still dated 2026-04-07.

A new agent following the official boot sequence (ORIENTATION → DASHBOARD → decision-log → STATE-SUMMARY) would have read three different ADR counts depending on entry path. The verification council 2026-04-20 caught it as a merge-blocker.

## Discovery

The trust hierarchy in ADR-0075 has an implicit invariant: **docs at lower layers must not assert counts or lists that contradict authoritative sources at upper layers.** Since the authoritative source for ADR count is "`ls docs/decisions/`", every doc that restates that count becomes a stale-candidate the moment a new ADR lands.

The maintenance failure mode is predictable:
1. Someone audits one doc (STATE-SUMMARY), fixes the numbers there.
2. Other docs quoting those numbers (INDEX, CLAUDE, ORIENTATION) aren't in the audit scope.
3. Next agent reads the upper-tier doc first, builds the wrong mental model, and doesn't notice until STATE-SUMMARY contradicts it.
4. Depending on which doc is read first, the agent either trusts a false count or a correct count randomly.

## Impact

Three rules going forward:

1. **Any doc refresh touching counts or lists MUST include a cascading update across all docs that restate those counts.** Practical: before closing a STATE-SUMMARY edit, `grep` across `docs/**/*.md` + `CLAUDE.md` for the old count and the new count. Every hit is either updated or justified in place.
2. **Prefer citation over restatement.** `docs/INDEX.md` should say "see `docs/decisions/` file listing" instead of asserting "74 ADRs". Restated counts are time-bombs.
3. **Top-of-hierarchy docs (ORIENTATION, CLAUDE.md) should link to the dynamic source, not cache the value.** Only STATE-SUMMARY is allowed to cache — and its frontmatter `updated:` date is the agent's signal to re-verify.

Promote to run-council SKILL.md Phase 7 rule: "When doc changes are approved in Phase 6, Phase 7 docs-tutor must grep for cascading restatements of any modified fact across all layer-1/2 docs (ORIENTATION, INDEX, root CLAUDE.md)."

## References

- Corrected today: `docs/INDEX.md` (74→163), `CLAUDE.md` root (54→163), `docs/ORIENTATION.md` (helpdesk/day-control/dual-platform rows added).
- Origin: 2026-04-20 verification council (this session) — steward + supervisor + agent-coord.
- Related: L-0078 (PLAN-file decay — same class of drift).
