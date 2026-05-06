---
title: JOURNEY — Audit Sortie 3, Telemetry Coverage Sweep
status: draft
created: 2026-05-06
updated: 2026-05-06
module: telemetry
tags: [audit, telemetry, adr-0004, journey]
sortie: feat/audit-sortie-3-telemetry-sweep
---

# User Journeys: Audit Sortie 3 — Telemetry Coverage Sweep

Internal observability journeys. No end-user surface — fixes ensure mutations land in audit trails, analytics, and event triggers.

---

## Journey: Outreach SMS sent emits to all four destinations

**Precondition:** `outreach` capability shipped with authority seed. Operator triggers `send_sms` tool with valid recipient + workspace + actor.

1. Operator triggers send_sms via Mr. Botsson → Capability tool resolves workspace_id + actor_id from JWT (ADR-0151) → callGateAction enforces authority → SMS dispatched via Twilio adapter → On success, `emit({ event: "outreach sms_sent", workspace_id, actor_id, entity_id })` fires → PostHog tracks event → Logger logs structured entry → activity_trail row inserted → engine_event row inserted → engine_trigger workflows can react (e.g. follow-up reminder) → Operator sees confirmation in Botsson chat.

**Postcondition:** SMS sent. Audit trail complete. Analytics complete. Workflow chain can fire on this event.

**Error paths:**
- Twilio fails → no emit fires → operator sees error message (ADR-0004 says emit only on success, not on error path).
- workspace_id resolves null → emit() throws (telemetry contract requires non-empty IDs) → tool returns error to operator.
- gateAction denies → SMS never dispatched → emit never fires.

---

## Journey: engine_world observation lands in audit trail

**Precondition:** Capability tool writes to `engine_world` table (e.g. `observe_workspace_state` from a future producer).

1. Capability tool resolves workspace_id (ADR-0151) → Writes observation row to `engine_world` via gatedMutation orchestrator → On success, `emit({ event: "engine_world observation_written", workspace_id, actor_id, entity_id: world_id })` → All 4 destinations populated → engine_event row enables downstream consumers (e.g. world-state diff workflow).

**Postcondition:** engine_world has new observation. Audit trail records who observed what when.

**Error paths:**
- Type mismatch on engine_world (database.types.ts not regenerated) → typecheck fails at build → operator never reaches runtime.
- gatedMutation denies → no row written → no emit.

---

## Journey: Manager sends contract to employee — full audit

**Precondition:** Manager ready to send signed contract template to specific employee. Currently `sendEmployeeContract` runs but emits nothing.

1. Manager picks template + employee → `sendEmployeeContract` capability tool fires → callGateAction passes → DocuSeal envelope created → contract row inserted → On success, `emit({ event: "contract sent", workspace_id, actor_id, entity_id: contract_id })` → activity_trail row → engine_event row → engine_trigger fires "contract.sent" workflow (e.g. notify employee, schedule reminder) → Manager sees confirmation.

**Postcondition:** Contract sent. activity_trail has full audit. engine_event chain consumable by reminders / dashboards.

**Error paths:**
- DocuSeal fails → tool returns error → no emit.
- workspace_id missing in resolution → tool errors before DocuSeal call.

**Pre-fix gap:** `sendEmployeeContract` runs the success path but never emits. Audit trail blind to a meaningful contract operation. Reminders dependent on `contract.sent` engine_event never fire.

---

## Journey: Developer adds new capability tool with mutation

**Precondition:** Developer ships new tool that writes to a workspace-scoped table.

1. Developer writes capability tool → Adds emit() in success branch → Runs typecheck → Sees error: "event 'foo bar' not in registry" → Developer adds the event to `packages/telemetry/src/registry.ts` with correct routing → Re-runs typecheck → Passes → CI grep `no-inline-gate-rpc` enforces gate compliance → CI lint enforces telemetry contract (ADR-0134 nonEmpty checks) → PR merges.

**Postcondition:** New mutation has full telemetry coverage from day one. No "shipped without registry events" regression like outreach + engine_world.

**Error paths:**
- Developer skips emit() → typecheck doesn't catch (emit is optional at type level) → audit trail blind. Mitigation: add explicit ESLint rule for capability tools requiring emit() in success branch (separate sortie).
- Developer adds emit but routes to wrong destinations → audit_trail or engine_event missed → workflow chain breaks. Mitigation: registry conventions per ADR-0004 — every mutation gets all 4 destinations.
