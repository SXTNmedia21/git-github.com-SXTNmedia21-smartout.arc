---
title: "Journey Rescue Path Reconciliation: journey.rescued vs guardian_signal"
id: ADR-0223
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0223: Journey Rescue Path Reconciliation

## Context and Problem Statement

A LIVE rescue path exists: `guardian_signal INSERT → AFTER trigger → dispatch_push_notification('journey_rescue', NEW.entity_id, ...)` (see `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql`, in production since 2026-04-06). The 2026-04-28 doc consolidation introduced a parallel proposal: stage-engine loads `RESCUE-PROMPT.md` on `journey.stuck` / `journey.run_failed` and emits a NEW `journey.rescued` event. The new event is not in `packages/telemetry/src/registry.ts` (verified 0 matches). Two parallel rescue systems = the B3 dead-infra trap (2026-04-13 helpdesk council, 90-day open-loop).

## Decision Drivers

- ADR-0078 + ADR-0163 channel restriction enforced via 3 layers (process / capability / tool); no need for 4th flag
- ADR-0175 telemetry contract = frozen 5 journey events. Adding 6th requires amendment.
- ADR-0196 Invariant 11: no phantom emits (event registered but no consumer or vice versa)
- ADR-0134 telemetry payload: `workspace_id` + `actor_id` mandatory, server-derived, never client
- ADR-0215 stuck-detector deferred (Option C); cron path live, event-driven path dead
- Existing `guardian_signal → push_dispatch` works for mobile journey rescue (production validated)
- L-0078 (this council): contract authors didn't grep migrations for domain keywords before authoring new event

## Considered Options

1. **Option A — Use existing `guardian_signal` path; drop `journey.rescued` event.** RESCUE-PROMPT.md content is consumed by existing push-dispatch path (already wired to mobile). New event NOT added to registry.
2. **Option B — New `journey.rescued` event + amendment to ADR-0175 (frozen-5 → frozen-6).** Stage-engine grows rescue-loader; existing `guardian_signal` path becomes legacy / deprecated.
3. **Option C — Both paths coexist with explicit role separation.** `guardian_signal → push_dispatch` for mobile rescue (existing). `journey.rescued` for stage-engine in-conversation context-screen (new). Distinct semantics.

## Decision Outcome

Chosen option: **"Option A"**, because the existing path is in production, ADR-0215 deferred event-driven stuck-detector, and adding a 6th journey event without a working consumer = phantom emit (Invariant 11).

If a future ADR reactivates ADR-0215 (event-driven stuck path) AND stage-engine grows a real loader, revisit Option B/C. Until then:

- RESCUE-PROMPT.md authoring continues per `docs/engines/system-intelligence/10-rescue-prompt-spec.md`
- The file is **input to the existing push-dispatch payload** when push fires for `journey_rescue`
- No new telemetry event added
- No `journey.rescued` reference in code, registry, or skill ops

## Rules & Consequences

- **Good, because** existing production path remains canonical; no parallel rescue system trap
- **Good, because** ADR-0175 frozen-5 contract preserved (no registry expansion without working consumer)
- **Good, because** ADR-0078 channel restriction layers are not duplicated (no `voice_safe` 4th-layer)
- **Bad, because** stage-engine in-conversation rescue context (chat-only Botsson scenarios) gets less rich data than mobile push — must rely on existing context-injection patterns
- **Bad, because** if ADR-0215 reactivates, this ADR needs amendment
- **Agent Impact:** Authors writing RESCUE-PROMPT.md must understand consumer is push-dispatch payload, NOT a stage-engine markdown loader. Telemetry-side: skill `ops/05-rescue.md` must NOT instruct registering a new event.

## References

- `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` (live rescue path)
- `docs/engines/system-intelligence/10-rescue-prompt-spec.md` (format spec)
- ADR-0078 + ADR-0163 (channel restriction layers)
- ADR-0175 (telemetry contract frozen-5)
- ADR-0196 (phantom-emit invariants)
- ADR-0215 (stuck-detector deferred)
- L-0153 (dual-rescue-system trap)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
