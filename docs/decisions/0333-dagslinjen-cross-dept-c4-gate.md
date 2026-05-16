---
id: ADR-0333
title: "Cross-Department Note Fanout — C4 Authority Gate"
status: proposed
date: 2026-05-15
deciders: [pontus, council]
tags: [communication, authority, c4, security]
supersedes: null
superseded_by: null
created: 2026-05-15
updated: 2026-05-15
layer: decision
---

# ADR-0333: Cross-Department Note Fanout — C4 Authority Gate

**Status:** Proposed
**Date:** 2026-05-15
**Verdict on lead-agent recommendation:** **AGREE-WITH-CHANGES** (capability name + Phase 2 allowlist hook clarified)

## Context and Problem Statement

The `dagslinjen-quickadd` feature (spec
`docs/superpowers/specs/2026-05-15-dagslinjen-quickadd-design.md`) introduces
`session_note.audience` JSONB targeting (dept_ids / team_ids / shift_ids /
profile_ids). The author writes once; the `note-fanout-scheduler` Edge
Function resolves the audience at `notify_at` and emits push/in-app per
recipient.

A manager assigned to **Dept X** must be prevented from blasting an audience
that resolves to recipients in **Dept Y** unless explicitly authorised. Three
enforcement points are available:

- **A.** Server Action gate at write — `gateAction()` per ADR-0099, writes
  `gate_evaluation` row, blocks the insert.
- **B.** RLS CHECK on insert — Postgres-level predicate cross-referencing
  `audience.dept_ids` against the caller's dept memberships.
- **C.** Deferred to fanout — write succeeds; scheduler silently filters
  cross-dept recipients out at fire-time.

The journey error-path
(`docs/journeys/JOURNEY-dagslinjen-quickadd-manager-target-note-fanout.md`)
specifies: *"Cross-department audience (manager scope): → Authority gate blocks
save, toast 'Kontakt admin for tverr-avdeling'."* That mandates **block at
write with a UI-actionable error** — Options B and C cannot satisfy this
without bolt-on UX duplication.

## Decision Drivers

- **ADR-0099 compliance** — every authority decision MUST produce a
  `gate_evaluation` audit row via the `gate_action` RPC; inline role checks
  are forbidden.
- **ADR-0189 compliance** — every capability literal MUST have a matching
  seed row in `*authority_seed*.sql`; CI parity check fails on missing seed.
- **ADR-0151 compliance** — actor profile_id is server-derived via
  `resolveCurrentProfile()`; never trusted from request body.
- **ADR-0204 compliance** — authority gate evaluated **first** in the
  orchestrator, before any RLS-bearing insert; reversing order is a
  structural bug.
- **Codebase precedent** — `add-booking-action.ts:129–138` is the
  canonical Server Action gate pattern; deviating without cause creates
  drift.
- **SMB hospitality reality** — manager occasionally needs to ping
  sister-dept (kitchen → bar) during ops. Hard admin-only floor blocks
  legitimate Saturday-night cross-team coordination.
- **Failure mode preference** — UI-visible, retry-able error beats silent
  fanout truncation; partial fanout corrupts trust in the channel.
- **Auditability** — cross-dept attempts (allowed AND denied) must be
  visible in `gate_evaluation` for post-hoc review and Phase 2 allowlist
  tuning.

## Considered Options

1. **Server Action `gateAction()` at write** (lead-agent recommendation)
   - Gate point: `create-targeted-note-action.ts` before insert
   - Capability: `comm.note_fanout_cross_dept`
   - Audit: `gate_evaluation` row per attempt (ADR-0099)
   - Failure mode: clear error → toast `"Kontakt admin for tverr-avdeling"`

2. **RLS CHECK on insert** — Postgres policy with predicate
   `(audience.dept_ids ⊆ caller_dept_ids) OR caller_role >= 'admin'`.
   - Pros: defence-in-depth; impossible to bypass via direct RPC.
   - Cons: error surfaces as raw Postgres CHECK violation (poor UX);
     **no `gate_evaluation` audit row** (ADR-0099 violation); cannot
     express "downgrade to confirm" or four-eyes patterns; cross-table
     dept membership join inside RLS policy is expensive at scale.

3. **Deferred filter at fanout** — write any audience; scheduler drops
   cross-dept recipients before emitting.
   - Pros: trivially simple writer; no policy surface.
   - Cons: **silent drop** = no UI feedback; author thinks 12 recipients
     were notified when only 8 were; deviates from journey error-path
     spec; no audit at gate-time (only at delivery-time); breaks ADR-0099
     "every authority decision = audit row".

## Decision Outcome

**Chosen: Option 1 — Server Action `gateAction()` with capability
`comm.note_fanout_cross_dept`** (with changes documented below).

### Gate point

`apps/web/src/app/dashboard/_actions/create-targeted-note-action.ts`,
**before** the `session_note` insert. Mirrors `add-booking-action.ts:129`.

### Capability name

`comm.note_fanout_cross_dept` — namespaced under `comm.` consistent with
the `MODULE_COMMUNICATION` registry. Specifically scopes to cross-dept
boundary crossing, not the broader `comm.note_create` (which Phase 2 may
seed separately at `manager` floor for own-dept).

### Min role (Phase 1)

`admin`. Manager-role attempting to write `audience` resolving to any
dept_id ∉ caller's dept-set triggers gate denial.

### Channel

`chat` (Server Action initiated from web UI). `voice` is **not** a
write-path for targeted notes in Phase 1 (would require ADR-0078
re-evaluation — note bodies may carry PII).

### Action type

`create` — single insert, no multi-stage approval. Four-eyes column
defaults `false` in seed; Phase 2 may flip to `true` for sensitive
audience patterns.

### Audit trail

Per ADR-0099 §6, `gate_action` RPC writes **one row to `gate_evaluation`
per call**, both for `allow=true` and `allow=false`. Schema (existing,
verified `database.types.ts:9521`):

```
gate_evaluation:
  - id (UUID v7, correlation_id per ADR-0204)
  - workspace_id, capability, channel, actor_profile_id, action_type
  - allow, reason, downgrade_to, min_role_required
  - parent_evaluation_id (NULL — this is the parent)
  - created_at
```

Additionally, on the success branch the Server Action emits
`comm.scheduled_note.created` to `activity_trail` per ADR-0134 with
`actor_id` + `workspace_id` branded `nonEmpty()`.

### Seed migration

Per ADR-0189, capability literal `comm.note_fanout_cross_dept` MUST have
a matching seed row in
`supabase/migrations/<TS>_seed_comm_note_fanout_cross_dept_authority.sql`:

```sql
INSERT INTO engine_authority_config
  (workspace_id, capability, level, min_role, requires_four_eyes,
   observer_escalation_hours)
SELECT workspace_id, 'comm.note_fanout_cross_dept', 'confirm', 'admin',
       false, 24
FROM workspace
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

`level='confirm'` (not `'execute'`) — admin must explicitly confirm the
cross-dept blast, no silent auto-execute even with role floor satisfied.

### Resolution of cross-dept vs own-dept at the gate site

`gate_action` RPC does not know about `audience` JSONB semantics. The
Server Action MUST classify before calling the gate:

```ts
const callerDepts = await getCallerDeptIds(profile.profileId);
const audienceDepts = resolveAudienceDeptIds(parsed.data.audience);
const isCrossDept = audienceDepts.some(d => !callerDepts.includes(d));

if (isCrossDept) {
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "comm.note_fanout_cross_dept",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Kontakt admin for tverr-avdeling." };
  }
}
// Own-dept path skips this gate — falls through to insert.
// Own-dept may have a separate capability `comm.note_create` if Phase 2 needs
// to floor that too; out of scope for this ADR.
```

The own-dept path is **not gated by this capability** — gating own-dept
manager activity at the same admin floor would block the primary use case.

### Audience resolution responsibility

Audience-dept extraction (`resolveAudienceDeptIds`) lives in
`packages/types/src/session-note.ts` as a pure function. It also runs at
fanout time inside `note-fanout-scheduler/audience-resolver.ts` for
recipient resolution. Single source-of-truth: both sites import the
same resolver.

## Rationale

- **Failure mode clarity.** Option 1 produces a UI-visible error the
  manager can act on (request admin, or drop the cross-dept recipients).
  Options 2 (CHECK violation) and 3 (silent drop) both fail closed
  invisibly — incompatible with the journey error-path spec.
- **Audit completeness.** ADR-0099 requires one `gate_evaluation` per
  authority decision. Option 1 produces it natively. Option 2 writes
  nothing. Option 3 writes only delivery telemetry, not authority
  telemetry — wrong table semantically.
- **Pattern consistency.** `add-booking-action`, `add-shift-action`,
  `report-deviation-action`, `confirm-shift-action`, and 8+ other
  Server Actions all use the same `gateAction()` from `_shared.ts:79`.
  Drift here would be unjustified novelty.
- **Phase 2 evolvability.** The capability + seed structure naturally
  extends to per-workspace allowlists (see Phase 2 plan below). RLS
  CHECK or deferred-filter would require schema replacement to evolve.
- **No double-gate.** This ADR does NOT propose RLS on top of the
  Server Action gate. Per ADR-0203, multiple gates may compose **only
  when they evaluate orthogonal policies** (C4 authority vs C1 cascade
  data-rule). Cross-dept membership is pure C4; one gate suffices.
  Existing `session_note` RLS continues to gate **reads** on workspace
  + session→department membership, unchanged.

## Phase 2 — Per-Workspace Cross-Dept Allowlist

When SMB hospitality friction surfaces (e.g. Bårdshaug Vegkro kitchen
manager Erik routinely needs to ping bar team at 18:00), Phase 2 adds
an allowlist mechanism **without** schema change to this ADR's gate
point:

1. **New table** `comm_cross_dept_allowlist` (workspace_id,
   from_dept_id, to_dept_id, created_at, created_by) with RLS on
   workspace_id.
2. **Modify `gate_action` RPC** to consult this table when capability
   = `comm.note_fanout_cross_dept`: if `(workspace_id, caller_primary_dept,
   target_dept)` row exists, downgrade `min_role` from `admin` to
   `manager` for that specific call. Audit row still written, with
   `downgrade_to='manager_allowlisted'` and `reason='cross_dept_allowlist_match'`.
3. **Admin UI** at `/dashboard/communication/cross-dept-permissions`
   to add/remove allowlist rows; gated separately on
   `comm.cross_dept_allowlist_admin` (min_role: admin).
4. **No code change at the Server Action site** — the gate semantics
   stay identical; only the RPC's evaluation changes. Manager attempts
   become `allow=true` when allowlisted.

Phase 2 trigger condition: first three workspaces independently report
manager-cross-dept-blocked friction in feedback OR audit reveals
>15 admin-confirmation requests/week for routine cross-dept pings.

## Consequences

**Good, because:**

- ADR-0099 / 0151 / 0189 / 0204 / 0078 all preserved.
- Audit trail captures every cross-dept attempt — denials are mineable
  for Phase 2 allowlist tuning ("which pairs are routinely blocked?").
- Failure mode is UI-actionable: manager sees toast, requests admin,
  or trims audience.
- Pattern is identical to 8+ existing Server Actions — zero learning
  curve, zero precedent for variation.
- Phase 2 extension does not touch this ADR's contract.

**Bad, because:**

- Phase 1 manager is strictly blocked from cross-dept pings; SMB
  workflow friction probable. Mitigated by Phase 2 allowlist + 24h
  observer-escalation default (admin gets surfaced request).
- Server Action layer carries audience-classification logic
  (`isCrossDept` check before gate). Mirror copy lives at fanout-time.
  Drift risk mitigated by single shared resolver in
  `packages/types/src/session-note.ts`.
- Audience containing **only** profile_ids (no dept_ids) requires
  resolving each profile's `primary_department_id` before classification.
  One extra query (joined). Acceptable cost — fanout already does this.
- Default-allow branch in `gate_action` (ADR-0099 §5, governed by
  ADR-0189) means a missing seed migration makes the gate transparently
  permissive. CI authority-seed-parity guards against this; runtime
  emits `gate.unseeded_capability_invoked` warning.

**Agent impact:**

- New capability literal `comm.note_fanout_cross_dept` must be added
  to seed migration before `create-targeted-note-action.ts` ships.
  CI fails otherwise (ADR-0189).
- Adding new audience targeting types (e.g. role-based "all bartenders
  in workspace") MUST consider whether they cross department lines and
  invoke `isCrossDept` accordingly.
- The Server Action MUST call `gateAction()` via `_shared.ts`
  helper — direct `supabase.rpc('gate_action', ...)` invocations
  outside `packages/ai/src/gate/gatedMutation.ts` are CI-blocked per
  ADR-0204.

## Audit Trail Format

Per `gate_evaluation` row written by `gate_action` RPC:

```
{
  id: "01938-...-uuid-v7",
  workspace_id: "<uuid>",
  capability: "comm.note_fanout_cross_dept",
  channel: "chat",
  actor_profile_id: "<manager-uuid>",
  action_type: "create",
  allow: false,
  reason: "min_role_required: admin (caller: manager)",
  downgrade_to: null,
  min_role_required: "admin",
  parent_evaluation_id: null,
  created_at: "2026-05-15T14:23:11.512+02:00"
}
```

On the success branch, a second row chains the downstream insert
emit via `correlation_id` (ADR-0204 SS-2).

## Acceptance Criteria

1. **Capability seeded** — migration
   `<TS>_seed_comm_note_fanout_cross_dept_authority.sql` exists with
   `level='confirm'`, `min_role='admin'`, `requires_four_eyes=false`,
   `observer_escalation_hours=24`; one row per existing workspace.
2. **CI authority-seed-parity passes** — `scripts/authority-seed-parity.ts`
   sees `comm.note_fanout_cross_dept` literal in
   `create-targeted-note-action.ts` matched by seed row.
3. **Server Action gates correctly** — manager attempting cross-dept
   audience receives `{ok:false, error:"..."}` with `gate_evaluation`
   row recorded (`allow=false`); admin attempting same receives
   `{ok:true, noteId}` with `allow=true` row recorded.
4. **Own-dept path unaffected** — manager creating note targeting
   only own-dept recipients does NOT hit this capability gate (no
   `comm.note_fanout_cross_dept` row in `gate_evaluation` for that
   call).
5. **Audience resolver shared** — `resolveAudienceDeptIds` in
   `packages/types/src/session-note.ts` is imported by both
   `create-targeted-note-action.ts` and
   `supabase/functions/note-fanout-scheduler/audience-resolver.ts`;
   no parallel implementation.
6. **E2E journey green** — `apps/web/e2e/dagslinjen-quickadd/target-note-fanout.spec.ts`
   covers (a) manager same-dept success, (b) manager cross-dept blocked
   with toast `"Kontakt admin for tverr-avdeling"`, (c) admin
   cross-dept success.
7. **Telemetry registered** — `comm.scheduled_note.created` event in
   `packages/telemetry/src/registry.ts` with destinations
   `[activity_trail, posthog, logger]`.

## Related ADRs

- ADR-0078 — channel restriction (voice forbidden for PII; note bodies
  may contain PII → chat-only writer in Phase 1).
- ADR-0091 — governance gate as Postgres RPC.
- ADR-0099 — unified authority gate (`gate_action` RPC + `gate_evaluation`
  audit row contract).
- ADR-0134 — telemetry contract (`emit()` with `nonEmpty()` branding).
- ADR-0151 — server-derived profile_id.
- ADR-0173 — capability boundary discipline.
- ADR-0189 — authority-seed-parity CI gate.
- ADR-0203 — dual gates are orthogonal policies, not unified
  (justifies single-gate decision here).
- ADR-0204 — composition orchestrator + `correlation_id` chaining.
- ADR-0244 — capability namespace conventions.
- ADR-0331 — Targeted note audience JSONB model (sibling, Q1).
- ADR-0332 — Scheduled fanout cadence (sibling, Q2).

---

> Council Round (dagslinjen-quickadd Gate 1, 2026-05-15): **AGREE-WITH-CHANGES**.
> Lead-agent recommendation accepted with three refinements:
> (1) capability namespaced `comm.note_fanout_cross_dept` (not unqualified);
> (2) `level='confirm'` not `'execute'` — admin must confirm, not auto-execute;
> (3) Phase 2 allowlist path explicitly captured at ADR-write-time to prevent
> later "we should have planned for this" sortie.
