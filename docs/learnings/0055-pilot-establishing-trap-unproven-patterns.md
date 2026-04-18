---
title: "Bundling N untested patterns into one 'pilot' guarantees pattern inversion"
id: LEARNING_0055
status: canonical
layer: learning
created: 2026-04-18
updated: 2026-04-18
tags: [council, pilot, migration, scoping, gate-client]
---

# Learning-0055: Bundling N untested patterns into one "pilot" guarantees pattern inversion

## Context

Gate-Client Migration Wave 2 briefing (2026-04-18) proposed a single PR
spanning three unproven patterns:

1. **Server Action migration** — proven by the Wave 1 pilot (`gatedwrite-pilot` 2026-04-17).
2. **Capability-tool dual-gate migration** — untested. The interaction between
   `cascade_gate_write` (C4 write gate) and `gate_action` (capability tool
   authority gate) is unresolved. Stacking order, ordering of audit entries,
   and proposed-outcome propagation all unknown in practice.
3. **TanStack-hook-with-gate inside optimistic updates** — no known codebase
   precedent. The pattern interaction between `useMutation` optimistic
   `onMutate` and a proposed-outcome from `cascade_gate_write` has never
   shipped.

Supervisor rejected on the basis that the first unresolved pattern would
become precedent for the others. Council's rescope (Wave 2A = Season only,
which is Server Action only — no capability, no TanStack optimistic) preserves
the pilot-validate-replicate rhythm.

## Discovery

When a "pilot" ships multiple untested patterns, the first one that ships
gets cited as "the pattern" even when it's the weakest of the three. The
order in which patterns land inside a bundled PR becomes arbitrary (depends
on file diff ordering, review order, who noticed what first), yet the first
one to merge inherits load-bearing-precedent status in future audits. This
inverts signal: what should be "the pattern we chose after proving all three"
becomes "the pattern that happened to land first".

Supervisor's rule: one unproven pattern per feature; subsequent features
inherit a proven baseline.

## Impact

**For scope approval:** Before approving any migration scope, classify each
pattern involved as "proven" or "unproven":

- **Proven** = exists in codebase with tests passing on the happy path AND
  edge cases (refusal, proposed, realtime reconciliation);
- **Unproven** = first codebase instance OR extends a proven pattern into a
  surface the proven version hasn't touched (e.g., Server Action → client
  hook, or web → capability).

**Reject any scope with >1 unproven pattern.** Sequence unproven patterns into
separate features.

**For this specific migration:** The Server Action pattern (proven by Wave 1)
can replicate to any other Server Action site without a new council. Capability
dual-gate and TanStack-with-gate each need their own small pilot feature
before being scoped into a wave.

**For council Phase 2.5:** Add a "pattern inventory" step. For each file
targeted by a migration plan, classify the pattern in use. If >1 unproven,
the migration is a council, not a PR.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-04-18 (Gate-Client Wave 2)
- Pilot that established Server Action pattern: `docs/council/COUNCIL-LOG.md` 2026-04-17 (gatedwrite-pilot)
- Related: Learning 0051 (post-implementation trace — different failure surface, same root cause: untested pattern shipped as precedent)
- Related: Learning 0044 (mobile parity framing creates feature graveyards — similar "bundle unproven work" shape)
