---
title: "Stuck-detector strategy — Phase 2 audit gap #5"
id: ADR-0215
status: accepted
layer: decision
created: 2026-04-27
updated: 2026-04-27
module: journey-engine
tags: [stuck-detector, L-0098, cutover, telemetry, phantom-contract, edge-function]
---

# ADR-0215: Stuck-detector strategy — Phase 2 audit gap #5

**Status:** Accepted
**Date:** 2026-04-27

## Context and Problem Statement

Phase 2 capability audit (2026-04-27, `docs/audits/PHASE-2-CAPABILITY-AUDIT-2026-04-27.md`) exposed gap #5: the stuck-detector dual-write claimed as "L-0098 step A complete" (M5.3, commit `541ee2e7`) is a paper contract. Zero capability tools schedule an `engine_delayed_trigger` row. The event-driven path in `supabase/functions/journey-stuck-detector/index.ts` (lines 278–471) is dead code — it cannot fire because no upstream caller deposits the trigger rows it needs.

Concrete evidence:

```bash
grep -rn "engine_delayed_trigger\|journey-stuck-detector" \
  packages/ai/src/capabilities/journey/
# → zero hits
```

The function's own docstring (lines 14–19) asserts "the `journey.run_dev` and `journey.run_guided` capability tools schedule a delayed invocation … using the step's `timeoutMs`" — this is false. `run_dev` (tools.ts:92–297) inserts `engine_state_step` rows and emits `journey.run_started` / `journey.step_reached` / `journey.completed` but never schedules a delayed trigger. `run_guided` (tools.ts:609–796) does the same.

The only live emission shape is the **legacy cron rescue mode** (lines 473–540): an hourly Supabase cron POSTs empty-body to the function, which scans `engine_state` for `journey_03_check_shifts` rows stuck on step 2 > 24 h and inserts `guardian_signal` rows. This mode predates ADR-0175 and does not emit `journey.stuck` — it emits to `guardian_signal` only.

Downstream impact:

- `journey.stuck` in `activity_trail` / `engine_event` receives zero writes from any journey run.
- The Fjernkontroll `stuck` state (ADR-0177) has no trigger source beyond the legacy cron, which covers only one hardcoded journey (`journey_03_check_shifts`, step 2, 24 h threshold).
- ADR-0175's `journey.stuck` event is registered in the telemetry registry but never emitted in the event-driven path for any other journey.
- M5 campaign-plan entry `[x] dual-write (L-0098 step A)` is a false-green claim, violating ADR-0196 Invariant 12.

This ADR does not fix the gap — that is implementation work. It frames the strategic decision the council must make before implementation begins.

## Decision Drivers

- **L-0094** (4th + recurring occurrence of phantom emit contracts) — the event-driven path is a phantom with a registered event but no caller.
- **L-0098** (3-step cutover principle: dual-write → flip → delete) — step A has not actually started despite the campaign claiming it complete.
- **ADR-0196 Invariant 11** — no phantom capabilities. The stuck-detector is not a capability tool, but the same structural failure applies: the edge function emits telemetry for runs that have no callers, making the artefact (the `journey.stuck` event) phantom.
- **ADR-0196 Invariant 12** — falsifiable status claims. M5.3 marked step A complete without a `verify:` block; the Phase 2 audit proved the claim was false.
- **M5 retraction precedent** — commit `36e1d8cc` retracted the `publish_mission` + `publish_guide` phantom bodies (same audit session, S8). The stuck-detector dual-write is the same pattern in the infra layer: a documented contract backed by zero code.
- **Runtime scope** — journeys currently reaching a `stuck` state in non-dev runs have no per-run stuck detection. The legacy cron covers one journey at one step, hourly.

## Considered Options

### Option A — Real dual-write (L-0098 step A, for real)

Capabilities (`runDevTool`, `runGuidedTool`) schedule an `engine_delayed_trigger` row immediately after inserting each `engine_state_step` row, using the step's `timeoutMs` from `JourneyIR`. The `fire-delayed-triggers` Edge Function (already a live consumer of `engine_delayed_trigger`, as confirmed by `supabase/functions/fire-delayed-triggers/index.ts:28,61`) fires the delayed POST to `journey-stuck-detector` on TTL expiry. The detector's event-driven path (lines 278–471) then emits `journey.stuck` to all four ADR-0175 destinations. The legacy `guardian_signal` cron stays active as fallback during the dual-write window (per L-0098 step A definition).

**Pros:**

- Closes the phantom contract correctly and completely — every step with a `timeoutMs` gets per-run stuck detection.
- `journey.stuck` begins flowing to `activity_trail` + `engine_event` for all journeys, not just `journey_03_check_shifts`.
- L-0098 step A actually runs; steps B and C become schedulable.
- Fjernkontroll `stuck` state (ADR-0177) gets a real trigger source across all journeys.
- Uses the existing `engine_delayed_trigger` + `fire-delayed-triggers` pattern — no new infra invented.
- Closes ADR-0175's `journey.stuck` event completely.

**Cons:**

- Capability tools must be modified (two locations: `runDevTool`, `runGuidedTool`), requiring re-audit for ADR-0196 Invariant 11 and 13 compliance.
- Every `JourneyIR` step without an explicit `timeoutMs` must either be skipped (no trigger scheduled) or use a default timeout — the default must be specified and seeded (ADR-0176 pattern).
- The `engine_delayed_trigger` schema FK requires `event_id` — `engine-dispatch` resolves this via an event insert before the trigger insert (lines 2656–2675). Capability tools would need the same pattern or a simplified insert without the FK (schema change required).
- `fire-delayed-triggers` currently runs as a Supabase scheduled cron — its polling interval determines stuck-detection latency. CLAUDE.md target is < 30 s; current polling interval is unknown and may need adjustment.
- Blast radius: 2 capability files + `fire-delayed-triggers` cron config + `engine_delayed_trigger` schema review. Medium.
- Work estimate: 1 sub-sortie (2–3 days). Includes: capability tool changes, trigger-insert pattern, FK resolution, default-timeout spec, integration test asserting `journey.stuck` emits to `engine_event`.

**Downstream impact:**

- Runtime users: stuck runs begin appearing in Fjernkontroll for any journey with `timeoutMs > 0` steps.
- Agent observability: `journey.stuck` events become real signals for monitoring.
- SLA: per-run stuck detection latency bounded by `fire-delayed-triggers` polling interval.

**Revert cost:** High — requires reverting capability tools (safe if wrapped in a feature flag or conditional) and removing trigger inserts from two tools.

---

### Option B — Kill the paper contract

Accept the `guardian_signal`-cron-only path as the canonical stuck-detection mechanism. Delete `supabase/functions/journey-stuck-detector/index.ts` (or collapse it to cron-only, removing the event-driven handler). Retract M5.3's `[x]` claim in the campaign plan with an explicit false-claim note. Update ADR-0175 in a separate vote to clarify `journey.stuck` is cron-emitted to `guardian_signal` only — not to `activity_trail` or `engine_event` via the four-destination pattern.

**Pros:**

- Kills the phantom immediately and honestly. No code that claims to do something it does not.
- Zero new implementation work. Reduces dead code surface.
- Aligns campaign doc reality with code reality.
- L-0094 spirit satisfied: the phantom is destroyed, not kicked to the next sprint.

**Cons:**

- `journey.stuck` **never** flows to `activity_trail` or `engine_event` for any journey except `journey_03_check_shifts` at step 2, 24 h. ADR-0175's four-destination contract for `journey.stuck` becomes partially void.
- Fjernkontroll `stuck` state has no event-driven trigger — it can only be detected by polling, or by manual intervention.
- The cron covers one hardcoded journey + step + threshold. Any new journey that needs stuck detection requires modifying the Edge Function hardcoded constants — exactly the problem L-0098 was trying to solve.
- Deleting the event-driven handler means re-implementing it later when M6/runtime work needs per-run stuck detection.
- ADR-0175 amendment requires a separate council vote (this ADR may not change ADR-0175 unilaterally).
- Blast radius: Edge Function deletion + ADR-0175 amendment + campaign plan retraction. Low for the deletion; medium for the ADR amendment.
- Work estimate: < 1 day for deletion + retraction prose. ADR-0175 amendment: 1 day (draft + council).

**Downstream impact:**

- Runtime users: no change from current behaviour — they experience the cron-only path today.
- Agent observability: `journey.stuck` events remain absent from `engine_event` for non-`journey_03_check_shifts` runs.
- SLA: no improvement. Hourly cron is the only stuck-detection window.

**Revert cost:** Very high — re-implementing the event-driven handler from scratch is equivalent to Option A, plus re-amending ADR-0175 again.

---

### Option C — Defer to a later phase entirely

Accept the gap as-is. Park it with a documented deferral note in the campaign plan. The `journey-stuck-detector` function remains unchanged. M5.3's false `[x]` is relabelled as `[ ] deferred to Phase 3+`. Focus shifts to the unblocked items: `publish_guide` body, mission resolution layer, Fjernkontroll exit-edge wiring (the three confirmed Phase 3 priorities in CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT).

**Pros:**

- Zero implementation cost. No new code touched.
- Phase 3 queue is already defined and sequenced — adding stuck-detector wiring competes with higher-priority unblocks (#1 publish_guide body, #2 mission resolution, #3 Fjernkontroll exit edges).
- Journey runtime functions without stuck detection — a run either completes or the user abandons. The `stuck` state is a quality-of-life signal, not a correctness requirement.
- Deferral is honest: it documents the gap without claiming to close it.

**Cons:**

- The phantom contract continues to exist in the codebase — the dead event-driven handler code stays, the docstring continues to lie about callers. This is a documentation-vs-code divergence that will confuse the next agent touching the file.
- L-0094 pattern: deferring phantom contracts has historically led to them being re-discovered 3–4 sprints later in a worse state. This is the 4th recurrence of this pattern (5th counting M5.3 publish_mission body).
- ADR-0196 Invariant 12 requires the false `[x]` to be corrected regardless of deferral — the claim cannot stay green.
- The CLAUDE.md §Trust-Gate §Phase 3 sequence already includes "Stuck detector Step B-flip + Step C-delete (L-0098 cutover)" as item #4. Deferring step A means B and C are further away.
- Blast radius: documentation only (campaign plan retraction). Negligible.
- Work estimate: < 2 hours to document the deferral correctly.

**Downstream impact:**

- Runtime users: no change.
- Agent observability: no change.
- SLA: no improvement.

**Revert cost:** None — no code was changed.

---

## Decision

**Proposed: Option C — Defer to a later phase, with mandatory false-claim correction.**

Rationale:

1. **Phase 3 queue priority ordering is correct.** The three confirmed Phase 3 items (`publish_guide` body, mission resolution layer, Fjernkontroll exit edges) are correctness deficits — journeys that cannot complete or cannot be published. The stuck-detector gap is an observability deficit. Observability improves quality; it does not unblock correctness. Prioritising it above correctness items is the wrong trade.

2. **Option A risks a 6th phantom (L-0094 pattern).** Wiring capability tools to schedule `engine_delayed_trigger` rows requires resolving the `event_id` FK (currently only `engine-dispatch` does this, via a multi-step insert pattern at lines 2656–2675), specifying a default timeout per step, and adjusting the `fire-delayed-triggers` polling interval. Each of these is a scope expansion that, under sprint pressure, tends to produce a "close enough" implementation that passes the Phase 2.5 grep gate but fails to produce real rows in `engine_event`. The pattern is documented four times in learnings. Option A done correctly costs a full sub-sortie; Option A done quickly is a 5th phantom.

3. **Option B is irreversible in the wrong direction.** Deleting the event-driven handler and amending ADR-0175 to remove the four-destination contract for `journey.stuck` is the right answer only if stuck detection will always be cron-only. It will not be — M5/M6 require per-run detection for the Fjernkontroll SLA. Re-implementing it later costs more than implementing it correctly once.

4. **Deferral is honest and bounded.** This ADR mandates the false-claim correction (ADR-0196 Invariant 12) and schedules Option A as the first item after Phase 3 correctness items close. The dead code stays but is explicitly labelled as "event-driven path: no upstream callers — scheduled for Phase 3+ wiring" in the docstring, replacing the false claim. No phantom is added; an existing one is contained.

The recommendation is opinionated: **C now, A next.** Not B (irreversible), not A first (wrong priority given the correctness backlog).

## Consequences

**Positive (for the recommended deferral):**

- Phase 3 priorities (#1 publish_guide body, #2 mission resolution, #3 Fjernkontroll exit edges) are unblocked immediately.
- The false `[x]` in CAMPAIGN-journey-engine.md is corrected in the same commit as this ADR — Invariant 12 satisfied.
- The dead event-driven handler is labelled accurately — next agent touching the file has correct signal.
- Option A is scheduled as a named Phase 3 follow-up item, not left as open-ended backlog.
- Zero risk of a 6th phantom from a rushed Option A implementation.

**Negative (for the recommended deferral):**

- `journey.stuck` does not flow to `activity_trail` / `engine_event` for any journey except `journey_03_check_shifts` for the duration of Phase 3 (estimated 2–3 sub-sorties).
- Fjernkontroll `stuck` state has no event-driven trigger source — any stuck-state UI testing in Phase 3 must inject the state manually.
- The legacy cron covers only one journey + step + threshold. Any new journey requiring stuck detection before Phase 3 wiring lands has no coverage.
- ADR-0175's `journey.stuck` event remains registered but unused for all journeys except the cron-covered one. This is a discrepancy that must be annotated in ADR-0175 as a known gap (not an amendment — an inline note until Option A closes it).

## Rejected Alternatives

**Option A rejected as premature.** The blast radius is correct and manageable, but the sequencing is wrong. Phase 3 has three correctness deficits ranked above observability. More importantly, the `engine_delayed_trigger` FK pattern (`event_id` required, per engine-dispatch lines 2656–2675) adds non-trivial schema coupling that needs its own sub-sortie with a proper schema review — not an afterthought appended to a capability tool patch. L-0094 has demonstrated four times that "wire it quickly alongside the main feature" produces a phantom. The correct answer is Option A on its own sub-sortie, after Phase 3 correctness items land.

**Option B rejected as destructive.** Deleting the event-driven handler or amending ADR-0175 to remove the four-destination contract for `journey.stuck` locks out per-run stuck detection permanently unless a future council re-opens ADR-0175. The Fjernkontroll SLA (< 30 s stuck detection) is a campaign commitment (CLAUDE.md §Mission) — Option B makes it structurally unreachable. Revert cost is too high for a gap that Option A closes correctly.

## Status History

- 2026-04-27 — Proposed (authored in Phase 2 audit, T4 sortie recommends Option C defer).
- 2026-04-27 — Accepted Option C (defer to Phase 3 #4) per Pontus directive.

## References

- Phase 2 capability audit: `docs/audits/PHASE-2-CAPABILITY-AUDIT-2026-04-27.md` (gap #5, C4 section)
- ADR-0175 (journey telemetry contract — `journey.stuck` event spec and four-destination rule)
- ADR-0196 (Journey Engine Invariants 11/12/13 — Invariant 12 mandates false-claim correction)
- L-0094 (phantom emit contracts — 4th recurrence; promoted to class rule by ADR-0197)
- L-0098 (global scripts cutover: dual-write → flip → delete; 3-step principle being violated)
- M5 retraction commit: `36e1d8cc` (publish_mission + publish_guide phantom bodies retracted — same pattern in capability layer)
- CAMPAIGN-journey-engine.md §REMEDIATION AMENDMENT → Phase 3 (canonical sequence #4 — stuck-detector Step B-flip + Step C-delete)
- `supabase/functions/journey-stuck-detector/index.ts` (event-driven path lines 278–471; legacy cron lines 473–540)
- `packages/ai/src/capabilities/journey/tools.ts` (`runDevTool` lines 92–297; `runGuidedTool` lines 609–796 — neither schedules `engine_delayed_trigger`)
- `supabase/functions/fire-delayed-triggers/index.ts:28,61` (existing `engine_delayed_trigger` consumer — the firing mechanism Option A would use)

## Appendix B — Reconciliation with ADR-0177 + ADR-0175 (added 2026-04-27 post-council)

The Fjernkontroll runtime state machine (ADR-0177) defines a `stuck` state. The journey telemetry contract (ADR-0175) defines a `journey.stuck` event. The stuck-detector deferral (this ADR, Option C) means the event-driven telemetry path is dormant. This is a partial-implementation gap, NOT a contradiction.

**The `stuck` UI state has three trigger sources:**
1. Manual `markStuck(stepKey)` dispatch from any UI/realtime layer (`useFjernkontrollMachine.ts:166`).
2. Realtime-driven derivation from `engine_state.status='waiting'` per M5.1.
3. Edge Function event-driven path (deferred per this ADR).

Paths 1 + 2 are alive — UI state is NOT orphaned. Path 3 is dormant.

**Telemetry consequence:** `journey.stuck` event does NOT flow to `activity_trail` / `engine_event` for any journey except `journey_03_check_shifts` (which has the legacy `guardian_signal` cron path). Other journeys cannot trigger the event at all today.

**Reactivation conditions for Option A (real dual-write):**
- Phase 3 correctness items closed (#1 publish_mission, #2 mission resolution, #5 publish_guide — all done as of 2026-04-27).
- B1 (engine_state vs engine_sessions ontology decision) resolved — capability tools then know which table to write step-progress to, which decides whether the stuck-detector listens for absence of progress.
- N-C worker (Phase 3 #3, out-of-this-campaign) shipped OR rescoped.

When all three land, this ADR moves from Option C → Option A in a follow-up amendment.

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
> Correct M5.3 `[x]` false claim in `docs/plans/CAMPAIGN-journey-engine.md` in the same commit (ADR-0196 Invariant 12).
> Add inline annotation to `supabase/functions/journey-stuck-detector/index.ts` docstring replacing false caller claim with accurate deferral note — same commit.
