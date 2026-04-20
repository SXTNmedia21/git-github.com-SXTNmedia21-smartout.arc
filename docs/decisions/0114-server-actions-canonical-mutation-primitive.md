---
title: "Server Actions as Canonical User-Initiated Mutation Primitive"
id: ADR_0114
status: accepted
layer: decision
created: 2026-04-16
updated: 2026-04-18
accepted_on: 2026-04-17
---

# ADR-0114: Server Actions as Canonical User-Initiated Mutation Primitive (with Capability Authority Relation)

## Context and Problem Statement

`apps/web/src/` has 193 `useQuery` calls across 155 files and a roughly equal population of `useMutation` call sites. Most mutations fire from TanStack `useMutation` with `onSuccess` callbacks calling `emit()` from `@smartout/telemetry`. In parallel, agent capabilities in `packages/ai/src/capabilities/` write to Supabase using `ctx.supabaseAdmin` (service-role client) via the Stage Engine.

Performance audit (2026-04-16) proposed migrating UI mutations to Next.js Server Actions to eliminate client→server round-trips for telemetry and to colocate gate calls with the data path. Council review surfaced three blockers: (a) Server Actions have no `onSuccess` callback, so `emit()` cannot be implicit; (b) the Postgres RPC governance gate (ADR-0091) must be called from both write paths; (c) three write paths now coexist (TanStack, Server Action, capability tool) and each has a different RLS posture — without explicit authority rules, agent-reported state and dashboard state can drift.

## Decision Drivers

- Performance: server-side `emit()` (react-server conditional export per ADR-0084) eliminates the `/api/telemetry` proxy hop
- Integrity: every mutation must continue to emit telemetry to `activity_trail` (audit) + `engine_event` (automation) + PostHog (analytics) + logger (stdout)
- Governance: ADR-0091 `cascade_gate_write` RPC (SECURITY DEFINER) must apply to every mutation regardless of invocation source
- Agent Trust Gate (Agent Coordinator, 2026-04-16): capabilities and dashboard mutations must not diverge in authority posture — Emma cannot truthfully report "shift approved" if a Server Action with different RLS context can reject the same shift invisibly
- Migration safety: 166+ existing mutations cannot be rewritten atomically

## Considered Options

1. **Keep TanStack mutations, do nothing.** Rejected: loses the perf win of server `emit()`, and doesn't resolve the governance blur.
2. **Move everything to Server Actions including capabilities.** Rejected: capability tools run inside the Stage Engine (separate process, different context) and require `supabaseAdmin` for cross-tenant operations. Not interchangeable.
3. **Server Actions for UI, capability tools for agent — with explicit contracts for both.** Chosen.

## Decision Outcome

**Chosen: Option 3 — dual write paths with canonical rules for each, unified through ADR-0091 gate.**

### Rules

#### R1. Invocation-source routing
- **UI-initiated mutations** (user clicks a button in the dashboard) MUST use **Server Actions** from `app/**/actions.ts` or `_actions/*.ts` files.
- **Agent-initiated mutations** (capability tool invoked by Stage Engine) MUST use **capability tools** that receive `ctx.supabaseAdmin`.
- A mutation that can be triggered from both sources implements the core logic as a shared function in `packages/data/` or similar, with both Server Action and capability tool as thin wrappers.

#### R2. emit() contract (MANDATORY in Server Action body)
- Every Server Action that mutates state MUST call `emit()` with a registered `SmartoutEvent` **before** returning the response to the caller.
- There is no implicit `onSuccess` — the migration rule is "where `useMutation.onSuccess` called `emit()` before, the Server Action body calls `emit()` after the DB write succeeds."
- Import from `@smartout/telemetry` in the react-server context — server conditional export is exercised (ADR-0084).
- Event must exist in `packages/telemetry/src/registry.ts`. If migrating a mutation whose event is unregistered, register the event FIRST.

#### R3. Governance gate contract
- Every Server Action writing to a governance-gated entity (per `isGovernanceGated()` in `packages/data`) MUST call `supabase.rpc('cascade_gate_write', ...)` (ADR-0091) rather than `supabase.from(...).insert()`.
- Every capability tool writing to the same entities MUST use the same RPC. No direct `supabaseAdmin.from().insert()` for gated tables.
- The `GateResponse` return shape (`ok | outcome: applied | proposed | blocked`) MUST be propagated to the UI layer. Toast and form handlers render the three outcomes as first-class states, not as success/error.

#### R4. RLS and authority posture
- Server Actions use `createServerClient` (cookie-backed, user-context) — honors RLS. Correct for UI mutations.
- Capability tools use `supabaseAdmin` (service-role) — bypasses RLS. Correct for agent mutations where the agent has already resolved authority via C4 and presents a justified cross-user action.
- Capability tools that touch user data must call `gate_action` (ADR-0099) BEFORE `supabaseAdmin.from()` to re-assert authority. No "trust the agent" shortcuts.

#### R5. Deprecation of TanStack mutations (staged)
- For realtime-backed entities (shifts, messages, notifications with Supabase realtime subscriptions), TanStack `useMutation` may continue — optimistic UI patterns matter.
- For non-realtime mutations (contracts, protocols, workspace config, employee data, etc.), new code MUST use Server Actions. Existing TanStack mutations migrate route-by-route as Sprint 2 RSC migrations land.
- ESLint rule (proposed follow-up): `no-tanstack-mutation` with allowlist by file path. Enforcement level: warn initially, error after all Sprint 2 routes migrated.

### Prerequisites (blockers)

- **ADR-0091 WP3** — `gate-client.ts` wrapper + ESLint rule blocking direct `from().insert()` on governance-gated tables. Council confirmed this is the prerequisite for Server Actions migration to avoid bypassing the gate by default.
- **Event registry coverage audit** — list every `useMutation.onSuccess` call site; confirm each calls `emit()` with a registered event; register missing events FIRST. The migration is the moment to enforce the contract, not loosen it.

## Rules & Consequences

- **Good, because** telemetry on server side eliminates one HTTP hop per mutation — measurable perf win.
- **Good, because** explicit `emit()` contract prevents silent telemetry drops during migration.
- **Good, because** unified gate RPC ensures capability tools and Server Actions have the same C4 governance posture — closes the Agent Trust Gate (Agent Coordinator).
- **Good, because** capability tools keep the `supabaseAdmin` pattern where it is genuinely needed (cross-tenant agent operations) — no contortion.
- **Bad, because** two write primitives increase surface area for new developers to learn. Mitigation: naming convention (`_actions/*.ts` for Server Actions, `packages/ai/src/capabilities/*/tools.ts` for agent tools) + ADR reference in CLAUDE.md.
- **Bad, because** shared business logic must be extracted to `packages/data/` or similar when a mutation can be triggered by both UI and agent — one-time refactor cost.
- **Agent Impact:**
  - New UI mutations: use Server Action, call `emit()` and `cascade_gate_write` inside the action body
  - New capability tools: use `supabaseAdmin`, call `gate_action`, emit from Stage Engine telemetry
  - Migrating existing mutations: move the `onSuccess.emit()` call into the Server Action body as the first step, verify event is registered
  - Agents (Emma, Botsson, WalkAi): behavior unchanged — capability tools remain the canonical agent-initiated path
  - Code-review: every Server Action that writes state is flagged for `emit()` presence during review until lint rule lands

### Related ADRs

- ADR-0084 — Telemetry conditional exports (react-server/default split) — this ADR exercises server emit path
- ADR-0091 — Governance gate placement (Postgres RPC) — this ADR extends coverage to Server Actions
- ADR-0099 — Unified authority-gate across agent-router and engine-dispatch — this ADR aligns Server Actions with the unified gate
- ADR-0076, ADR-0093 — Contract/cascade drafts through unified `apply_cascade` — Server Actions writing to cascade-gated tables route through these
- ADR-0113 — DashboardContext decomposition — no direct dependency but shared Sprint 3 scope

## Acceptance — 2026-04-17 (scope-corrected 2026-04-18)

Promoted to `accepted` for the full contract layer (R1–R5). R3 (write-path governance via `gatedInsert/Update/Delete`) moved from Scaffolded to Shipped on 2026-04-18 when ADR-0091 WP2 landed.

- **Shipped (R1, R2, R3, R4, R5):**
  - Server Actions as canonical mutation primitive (established pattern in `apps/web/src/app/**/_actions/*.ts`)
  - `emit()` telemetry contract per `packages/telemetry/src/registry.ts`
  - Telemetry registry audit at `docs/reports/telemetry-registry-audit-2026-04-17.md` (398 events registered, 186 unique emitted, 213 phantom entries flagged for cleanup)
  - ESLint rule `smartout/no-direct-supabase-write` at `warn` severity in `packages/eslint-config/` (commit `b90dc1f5`) — currently advisory; escalation path is unblocked now that WP2 ships
  - `packages/supabase/src/gate-client.ts` exports `gatedInsert`/`gatedUpdate`/`gatedDelete` (commit `b90dc1f5`) — now functional end-to-end after ADR-0091 WP2 shipped on `feat/cascade-gate-write` (commits `2278ef52` + `6a431ce2`)

- **Prerequisites:**
  1. ~~Ship ADR-0091 WP2 — Postgres migration creating `public.cascade_gate_write` with signature + body per ADR-0091 decision drivers~~ **DONE 2026-04-18** (see ADR-0091 Implementation Status; commits `2278ef52` + `6a431ce2`)
  2. Add a smoke test that invokes `gatedInsert` against local Supabase and asserts the RPC resolves — pgTAP suite at `supabase/tests/cascade-gate-write.sql` now covers the RPC end-to-end per commit `6a431ce2`; a TS-side smoke in `@smartout/supabase` follows with the first call-site migration

- **Next steps (now unblocked):**
  1. Migrate first call sites from direct `.from().insert/update/delete()` on governance-gated tables to the `gated*` helpers — the ESLint rule's warning list is the worklist
  2. Once migration covers the governance-gated surface, escalate the `smartout/no-direct-supabase-write` ESLint rule from `warn` → `error` to make direct writes on gated tables a CI-blocking error

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
