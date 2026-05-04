---
title: "Phantom contracts — promotion of L-0094 after 5th occurrence with new failure mode"
id: ADR-0197
status: accepted
layer: decision
created: 2026-04-23
updated: 2026-04-23
module: governance
tags: [phantom, emit, capability, promotion, learning-to-adr, telemetry, contract]
---

# ADR-0197: Phantom contracts — promotion of L-0094 after 5th occurrence with new failure mode

## Context and Problem Statement

L-0094 ("phantom emit contracts recurring") was logged 2026-04-21 after its 4th observed occurrence. Each occurrence shared a shape: an emit path was registered (or documented) without a matching producer or consumer. On 2026-04-23 a **5th occurrence with a new failure mode** surfaced in campaign `journey-engine`: two capability tool **bodies** (not just emit sites) return `ok:true` and emit `journey.run_started` while producing no domain artefact. This is a phantom body — one layer deeper than a phantom emit.

Promotion rule (`council_meta.md` / SKILL.md): a learning observed ≥3 times earns promotion to an ADR (enforced rule). L-0094 is now at 5 occurrences across ≥100 days.

## Decision Drivers

- L-0094 cannot be relied on as advisory — five occurrences across the codebase prove the pattern outruns human discipline.
- The 5th occurrence introduces a new failure mode (phantom body) that the existing Phase 2.5 emit-registry grep does not catch.
- ADR-0196 introduces Campaign Invariant 11 (no phantom capabilities); this ADR codifies the underlying class rule beyond the journey-engine campaign.

## Considered Options

1. **Option A — Promote L-0094 directly to an ADR with enforcement rules.** Canonical pattern per skill.
2. **Option B — Split into two ADRs: phantom-emit (existing Phase 2.5 gate covers) + phantom-body (new).** Over-fragmentation; same class.
3. **Option C — Add to existing ADR on telemetry / ADR-0175.** ADR-0175 is specific to journey events; scope too narrow.

## Decision Outcome

Chosen option: **"Option A — Promote L-0094 to ADR"** with two failure modes codified: phantom emit + phantom body.

## Rules & Consequences

### Rules — phantom contract class definition

A **phantom contract** is any declared interface (event, capability, API) whose declared effect is not produced by the code reachable from the declaration. Three failure modes:

**Mode 1 — Phantom emit.** An event declared in `packages/telemetry/src/registry.ts` with no producer (no `emit()` call with that key) OR no consumer (no downstream handler). Occurrences: 2026-04-19 helpdesk, 2026-04-20 wave-h L-0103, 2026-04-21 journey-runner briefing, 2026-04-22 contract-hub inconsistent shapes.

**Mode 2 — Phantom body.** A capability tool whose `execute()` function emits success telemetry but produces no domain artefact (no DB write, no file write, no external side effect). Occurrence: 2026-04-23 journey-engine publish_mission + publish_guide.

**Mode 3 — Phantom status claim** (added by this ADR, forward-looking). A milestone / campaign-status claim unbacked by a mechanical verification. Occurrence: 2026-04-23 campaign doc claimed "M1–M3.5 complete, 7/7 unblocks closed" while unblock 4 had silently regressed to phantom bodies.

### Enforcement

1. **Phase 2.5 council fact-check** (existing, extended): for every emit path named in any plan/spec, grep for (a) the registry entry, (b) at least one producer call site, (c) at least one consumer. Missing any of the three = FALSE claim.
2. **`close-feature.sh` gate** (new): grep `packages/**/capabilities/**/tools.ts` for the phantom-body shape — `emit\(.*run_started.*\)` followed within 40 lines by `return.*\{.*ok:.?true` with no intervening `.insert(` / `.update(` / `.delete(` / `writeFile` / `fetch\(.*method: ['"`]POST`. Any match blocks merge.
3. **Status-claim gate** (new): any change to `docs/plans/CAMPAIGN-*.md` that adds "complete" / "green" / "closed" language MUST add a `verify:` code-fence with the shell / SQL / test command that proves it. `close-feature.sh` greps diff for unbacked claims.
4. **Failure mode registry**: this ADR's "three failure modes" section is the canonical definition. New modes appended here (not in ad-hoc learnings) after the 3rd occurrence per mode.

### Consequences

- **Good, because:** the class is named and enforced rather than re-discovered each council.
- **Good, because:** Mode 2 (phantom body) has an automated gate rather than relying on reviewer discipline.
- **Good, because:** Mode 3 turns prose campaign claims into falsifiable artefacts.
- **Bad, because:** grep heuristics have false positives; exceptions must be marked with `// noqa: phantom-contract` and justified in review.
- **Bad, because:** adds friction to campaign doc writes — every "complete" row needs a verify block.
- **Agent Impact:** Build agents implement capability bodies fully before emitting. Documentation agents attach verify commands to status rows. Review agents run the phantom-body grep as a Phase 2.5 standard step.

## References

- L-0094 (promoted here)
- L-0124 (phantom body vs phantom emit distinction — same council)
- L-0125 (test spirit vs letter)
- ADR-0196 (Invariants 11/12/13 — journey-engine-scoped instance of this rule)
- ADR-0175 (journey telemetry contract — Mode 1 domain)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-23
- Prior occurrences: 2026-04-19 / 2026-04-20 / 2026-04-21 / 2026-04-22 / 2026-04-23

---

> After writing: register in `docs/decisions/0000-decision-log.md`. Cross-reference from L-0094 to mark it promoted.
