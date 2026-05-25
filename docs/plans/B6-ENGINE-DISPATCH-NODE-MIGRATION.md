---
title: "B6 — engine-dispatch Node Migration (deferred sortie)"
status: proposed
type: campaign-plan
updated: 2026-05-25
created: 2026-05-25
module: ai
affected_domains: [engine-dispatch, stage-engine]
tags: [plan, deferred, b6, engine-dispatch, harness-architecture]
related_adrs: [ADR-0424, ADR-0265, ADR-0151, ADR-0356]
supersedes_when_landed: "ADR-0424 §Transport layer (HTTP bridge interim)"
---

# B6 — engine-dispatch Node Migration

> Status: **proposed / deferred**. Captures Harness Specialist (system-agent-coordinator)
> dissent from Council R6 2026-05-25 PM (4-reviewer council; 3:1 majority chose interim HTTP
> bridge for ADR-0424 §Transport, dissent accepted as future sortie). This document is the
> placeholder for that future direction; it is not currently scheduled.

## Background

ADR-0424 introduced the dispatcher action-type `invoke_capability_tool`. Phase 2 surfaced a
structural blocker: the action handler must execute inside
`supabase/functions/engine-dispatch/index.ts` (Deno EF) but capability tool bodies +
`resolveCapabilityTool()` live in `packages/ai` (Node ESM). Deno cannot import Node ESM.

Council R6 chose the **HTTP bridge** path (PR #481 Node endpoint + PR #482 EF thin proxy) as
the **interim** solution. The dissenting argument (Harness Specialist) was that the bridge
itself is the same "logic beside cascade" anti-pattern ADR-0424 was meant to close, just
surfaced one layer deeper. The clean architectural resolution is to retire the EF entirely
and run `engine-dispatch` as a Node service.

This plan documents the future direction. **It supersedes ADR-0424 §Transport when landed.**

## Vision

Migrate `engine-dispatch` from a Deno Edge Function to a Node service so capability tool
invocation runs in-process with `resolveCapabilityTool()`, no HTTP bridge, no
`STAGE_ENGINE_INTERNAL_KEY`.

After migration:

- `engine-dispatch` is either folded into `services/stage-engine` (sub-route) or runs as a
  standalone `services/engine-dispatch-node` service.
- `invoke_capability_tool` action handler executes `tool.execute()` directly via static
  import, no fetch().
- `STAGE_ENGINE_INTERNAL_KEY` retired; one fewer secret to rotate.
- `engine.dispatch.bridge_invoked` telemetry event retired (transport fact disappears).
- pg_cron triggers + EF→service routing swap to the new Node service URL.

## Scope

### In scope

- New Node service (or stage-engine sub-route) hosting the dispatcher loop.
- Port action handlers (`wait_for_event`, `assign_task`, `send_notification`,
  `update_entity`, `create_deviation`, `validate_settlement`, `lock_checkout`,
  `schedule_control`, `start_process`, `upsert_session`, `invoke_capability_tool`) from
  Deno-flavored TS to Node-flavored TS.
- pg_cron URL swap: from EF endpoint to Node service endpoint.
- EF stub `engine-dispatch` deprecated (kept as redirect / 410 Gone window before deletion).
- Deploy pipeline parity: ensure Node service deploys on the same merge-to-main cadence as
  the EF previously did (ADR-0265 protected).
- Drift-check parity: `infra/scripts/drift-check.sh` updated to track the new env channel.

### Out of scope

- Touching dispatcher action **semantics** (handlers' business logic). Migration is
  transport-only; behavior preserved bit-for-bit.
- Touching pg_cron schedules. URL only.
- Touching `engine_state` / `engine_state_step` schema.
- Touching capability tool boundaries (ADR-0173 frozen-4 stays frozen).

## Why it's deferred (not now)

1. **Campaign-scale refactor.** Touches pg_cron targets, EF→service routing, deploy pipeline,
   drift-check, secrets rotation. Not a sub-sortie.
2. **Blocks on parallel work.** Pre-conditions before B6 can start:
   - C2 campaign current sortier (sortie G) must land first — they consume the
     `invoke_capability_tool` action-type via the bridge.
   - Service deploy pipeline (DigitalOcean droplet / Vercel pattern decision) must be settled
     for `engine-dispatch-node` (currently TBD whether new service or stage-engine sub-route).
   - pg_cron URL rewrite tooling must exist (or be added as part of B6).
3. **Bridge is acceptable interim.** It honours ADR-0151 §Cross-runtime extension, ADR-0356
   audit symmetry (gate co-located with execute), and ADR-0193 telemetry routing (4-dest
   execution event + 3-dest transport event). The interim is correctly bounded.

## Trigger conditions to schedule B6

Schedule B6 when **any** of the following becomes true:

- ≥2 additional dispatcher action-types need Node ESM imports (recurring class problem).
- `STAGE_ENGINE_INTERNAL_KEY` rotation cadence becomes operationally painful.
- Drift-check or audit surfaces the bridge as a recurring high-severity finding.
- C2 campaign close-out reveals operational issues with the bridge (latency, multi-instance
  race, etc.).

Otherwise B6 stays parked.

## Migration outline (sketch — to refine when scheduled)

1. **Decide host:** sub-route in `services/stage-engine` OR new `services/engine-dispatch-node`.
   Pros/cons doc + ADR if non-trivial.
2. **Port one action handler at a time** (start with `wait_for_event` — pure read, lowest
   risk) behind a feature flag (`ENGINE_DISPATCH_NODE_HANDLERS=...`).
3. **Run EF + Node in parallel** during cutover; pg_cron triggers EF, EF dispatches to Node
   per flag. Allows per-action-type rollback.
4. **Flip pg_cron URL** once all handlers ported + soak time green.
5. **Retire EF + bridge:** delete `supabase/functions/engine-dispatch/`, retire
   `STAGE_ENGINE_INTERNAL_KEY`, retire `/internal/engine-dispatch/invoke-capability-tool`
   (or fold into direct call), retire `engine.dispatch.bridge_invoked` telemetry event.
6. **Update ADR-0424:** add "Superseded by ADR-XXXX (B6 dispatcher migration)" header on
   §Transport layer section, write new ADR documenting the consolidated dispatcher.

## Acceptance Criteria (placeholder — when B6 schedules)

- [ ] All dispatcher action-types execute Node-side; no EF dispatcher in `supabase/functions/`.
- [ ] `STAGE_ENGINE_INTERNAL_KEY` removed from 1Password + `.env.template` + drift-check.
- [ ] `engine.dispatch.bridge_invoked` telemetry event removed from
      `packages/telemetry/src/registry.ts`.
- [ ] pg_cron targets point at the Node service.
- [ ] ADR-0424 §Transport layer marked "Superseded by ADR-XXXX".
- [ ] New ADR documents the consolidated dispatcher.
- [ ] Typecheck + audit + drift-check green.

## References

- ADR-0424 — `invoke_capability_tool` Engine-Dispatch Action-Type Contract (§Future evolution
  is the formal pointer to this sortie)
- ADR-0265 — Enforced deployment pipeline (B6 must preserve)
- ADR-0151 — Server-derived workspace_id (cross-runtime extension stops mattering once
  there's one runtime)
- ADR-0356 — Cascade-namespace-delegation (audit symmetry; B6 simplifies because gate +
  execute end up trivially co-located)
- Council R6 2026-05-25 PM (transport-layer escalation, 3:1 HTTP bridge majority, harness
  B6 dissent — captured as L-0361)
- L-0361 — ADR-missing-cross-runtime-dimension (3rd-occurrence pattern)
