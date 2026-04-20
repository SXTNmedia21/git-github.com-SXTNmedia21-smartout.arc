---
title: "Grep-based site inventories inflate scope and miss integrity breaches"
id: LEARNING_0054
status: canonical
layer: learning
created: 2026-04-18
updated: 2026-04-18
tags: [council, audit, migration, fact-check, gate-client]
---

# Learning-0054: Grep-based site inventories inflate scope and miss integrity breaches

## Context

Second verified occurrence of the audit-inflation pattern (first: Web Performance
Council 2026-04-16). In the Wave 2 Gate-Client Migration council briefing
(2026-04-18), a grep for `.from("schedule_shift"|"season").(insert|update|delete)`
returned "18 sites" but the briefing mislabeled 9 of them (useShiftClock +
LeaderOverview classified as "raw async" when they're actually TanStack
`useMutation`), missed a live ADR-0091 violation in the capability layer
(`shift-lifecycle/tools.ts:177-181`), missed a D2 orphan
(`contract-intake/tools.ts:221`), missed a security vulnerability
(`agent-router.ts:207` forwards `profile_id` unverified), and missed an active
telemetry bug (Season wizard emits `"button clicked"` with trackingId
`"season-created"` instead of the registered `"season created"` event).

Five distinct findings that a count-based audit would have shipped blind.

## Discovery

Briefings built on grep-counts produce false scope confidence. The grep tool
answers "where does this string occur?" but the council needs answers to
"what is the classification, the payload, the receive-side handler, the
adjacent package coverage, and the current emit contract of each site?"

Supervisor + Agent Coordinator code-trace with line numbers caught all 5
misses. Counter-pattern: pair every grep-site-count briefing with a
code-trace verification before the briefing enters Phase 3.

## Impact

**For migration plans:** For any plan citing "N sites found via grep", require
a follow-up fact-check pass that:

- (a) verifies the classification of each site (raw async vs. TanStack
  `useMutation` vs. Server Action);
- (b) greps adjacent packages (not just `apps/web/src`) for same-table writes
  (`services/`, `packages/ai/`, `supabase/functions/`);
- (c) reads the current `emit()` call at each site to verify it matches a
  registered event name (grep `packages/telemetry/src/registry.ts`);
- (d) traces receive-side code for any capability tool that writes the
  target table — capability writes often bypass the same gate the web path
  respects.

**For the run-council SKILL:** Phase 2.5 fact-check must include a
"classification audit" step for any migration scope over 3 sites. Counts
without classification are not briefings — they are vibes.

**For reviewers generally:** Treat every grep-count in a plan doc as a
claim to be verified, not a fact. "18 sites" is a hypothesis; the
classification of those 18 is the data.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-18 (Gate-Client Wave 2)
- Prior occurrence: Web Performance Council 2026-04-16 (audit-inflation pattern)
- Related: Learning 0042 (plan documents not ground truth for migration deps)
- Related: Learning 0043 (audit column→table identity must be verified)
- Related: Learning 0051 (4-layer post-impl trace beats per-file review)
- Evidence: `packages/ai/src/capabilities/shift-lifecycle/tools.ts:177-181` (ADR-0091 violation missed)
- Evidence: `packages/ai/src/capabilities/contract-intake/tools.ts:221` (D2 orphan write missed)
- Evidence: `services/stage-engine/src/agent-router.ts:207` (unverified profile_id missed)
