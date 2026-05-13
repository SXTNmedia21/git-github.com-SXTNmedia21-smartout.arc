---
title: "D6 RLS WITH CHECK invariants — per-verb + role-gate + service-role boundary"
id: ADR_0313
status: proposed
date: 2026-05-14
created: 2026-05-14
updated: 2026-05-14
module: schedule
layer: decision
tags: [rls, d6, cascade, security, governance, sortie-protocol]
---

# ADR-0313: D6 RLS WITH CHECK invariants — per-verb + role-gate + service-role boundary

## Context

Sortie A.2 (`feat/sortie-a2-d6-rls-with-check`) closes the four D6 sister-table `FOR ALL USING(...) no-WITH-CHECK` gaps identified by the 2026-05-13 audit (F-DB-09 CRITICAL + F-DB-10 HIGH) on `department_session`, `session_hook`, `deviation`, and `personal_task`. Migration `20260608120000_sortie_a2_d6_rls_with_check.sql` ships the main consolidation; migration `20260614120000_session_task_insert_with_check.sql` closes the companion `session_task` INSERT gap mandated by ADR-0303.

### Root cause

Pre-Sortie-A.2, all five D6 tables carried `FOR ALL USING(workspace_id IN ...)` policies — inherited from the original session_infrastructure migration (2026-04-12). The `FOR ALL` shape has a structural defect on mutation verbs: PostgreSQL evaluates USING on the old-row state (pre-mutation) but does NOT evaluate WITH CHECK on the new-row state unless an explicit `WITH CHECK` clause is present. A JWT caller who is a member of two workspaces can therefore:

1. Pass USING by presenting a legitimate old-row (workspace A, which they belong to).
2. Flip `workspace_id` in the UPDATE payload to workspace B (which they also belong to).
3. Skip WITH CHECK entirely because no such clause exists.

Result: cross-workspace data movement via direct PostgREST UPDATE, with no privilege error. This is the same root class as L-0107 (authority appearance ≠ authority presence) and ADR-0151 (server-side workspace_id derivation — the server must derive workspace context, not accept it from the request body without re-validation).

`deviation` carried the additional gap that no role gate existed at all: any workspace member — including employees — could INSERT, UPDATE, or DELETE deviation rows. The F-DB-10 finding on `personal_task` was narrower (owner-only model via profile_id was present, but workspace_id cross-workspace forgery was possible through the same USING-only mechanism).

ADR-0299 (Sortie A, 2026-05-13) closed the same gap class on `shift_approval`. ADR-0303 (sister-sweep rule) mandates this sweep is part of the same sortie lifecycle. This ADR documents the concrete predicate shape and role-gate choices so future D6 table authors have a canonical pattern to copy.

## Decision

### Invariant 1 — Per-verb policies: no `FOR ALL` on D6 mutation surfaces

`FOR ALL USING(...)` is forbidden on D6 tables. Each verb gets its own policy. The canonical split is:

| Verb | Policy suffix | USING | WITH CHECK |
|------|--------------|-------|-----------|
| SELECT | `jwt_read_<table>` | workspace membership | — (SELECT has no WITH CHECK) |
| INSERT | `jwt_insert_<table>` | — (INSERT has no old-row state) | workspace membership + role gate |
| UPDATE | `jwt_update_<table>` | workspace membership + role gate | workspace membership + role gate (MUST mirror USING exactly) |
| DELETE | `jwt_delete_<table>` | workspace membership + role gate | — (DELETE has no WITH CHECK) |

A `FOR ALL` policy on any D6 table is a merge blocker per ADR-0303 §Sister-sweep rule.

### Invariant 2 — Symmetric USING = WITH CHECK on UPDATE

The UPDATE policy USING and WITH CHECK predicates MUST be identical on workspace_id and role conditions. This is the mechanical defense against the forgery class: if USING passes on the pre-mutation row, WITH CHECK re-evaluates the same predicate on the post-mutation row. A workspace_id flip from A to B fails WITH CHECK if B is not in `get_workspace_ids_for_user(auth.uid())`.

Exception: `personal_task` UPDATE uses a combined `EXISTS` join on `profile` for both USING and WITH CHECK (owner model — the ownership predicate pinning `profile_id` AND `workspace_id` to caller's active profile is the full invariant, not a plain workspace membership list).

### Invariant 3 — Per-table role gates

Role gates are chosen based on the table's D6 operational purpose:

| Table | INSERT/UPDATE/DELETE role gate | Rationale |
|-------|-------------------------------|-----------|
| `department_session` | admin, owner | Session lifecycle is management-plane only (opening/closing a shift session). |
| `session_hook` | admin, owner | Hook authoring is configuration (schedule authoring surface, admin-only UI). |
| `deviation` | admin, owner, manager | Day-control write surface; managers report and resolve deviations. Employees SELECT only (read transparency). |
| `session_task` | admin, owner, manager (INSERT); all members (UPDATE) | Managers create tasks; employees complete them (mark in_progress / done). |
| `personal_task` | owner only (profile_id = caller + workspace_id = caller profile) | Personal task model — self-assigned, self-completed. No manager escalation path. |

### Invariant 4 — Service-role boundary

All JWT policies described in this ADR are **defense-in-depth**. The primary write path for all five D6 tables runs through:

- `stage-engine gatedMutation` (ADR-0204) when the SS-4 authority flag is enabled — writes via `ctx.supabaseAdmin` (service_role), bypassing JWT policies entirely.
- `gateAction` RPC wrapper (ADR-0287) when the engine-dispatch path is active — also service_role.
- Dashboard Server Actions (where present) — `createClient({ serviceRole: true })`, service_role, ADR-0179.

JWT RLS policies therefore govern:
1. Direct PostgREST calls from browser clients (defense-in-depth against forged payloads).
2. Mobile BFF calls that use the user's JWT (defense-in-depth via ADR-0132 mobile routing).
3. Any future JWT-path writer not yet anticipated.

The C4 governance layer (engine_authority_config, change_proposal) owns the upstream authorization decision for agent-driven mutations. "JWT policy passes" is NOT the same as "mutation is authorized" — C4 owns authorization; JWT RLS owns forgery prevention. Never conflate them.

### Rule for future D6 table authors

When adding a new D6 table:

1. Enable RLS: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
2. Create four per-verb policies (SELECT / INSERT / UPDATE / DELETE) — never `FOR ALL`.
3. INSERT WITH CHECK and UPDATE WITH CHECK MUST pin `workspace_id` to `get_workspace_ids_for_user(auth.uid())`.
4. Set the appropriate role gate from Invariant 3 above (or document your choice in the table's ADR).
5. Run the ADR-0303 sister-sweep query after shipping — zero rows required before declaring the gap class closed.
6. Write paired pgTAP tests: `throws_ok` (42501) for the role-gate rejection + `lives_ok` for the happy path.

## ADR cross-references

- **ADR-0151** — server-side workspace_id derivation. JWT policies implement this at the DB layer: `workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))` is the canonical predicate.
- **ADR-0299** — Sortie A. Closes the same gap class on `shift_approval`. This ADR is the implementation-level companion for the five sister D6 tables.
- **ADR-0303** — Sister-table sweep rule. Mandates that every D6 governance audit finding triggers a sweep before close-feature. ADR-0313 closes the sweep started by ADR-0303 §Sweep query (zero `FOR ALL USING / no-WITH-CHECK` rows on all 10 D6 tables after both migrations apply).
- **ADR-0204** — gatedMutation. Primary write path for agent-driven D6 mutations; bypasses JWT policies via service_role.
- **ADR-0287** — gateAction RPC wrapper. Secondary write path for engine-dispatch; also service_role.

## Consequences

- **Good:** closes the forgeable-workspace-id class on all five affected D6 tables (plus the Sortie A closure on shift_approval = six tables total). After ADR-0313 migrations apply, the ADR-0303 sister-sweep query returns zero rows on the full D6 table list.
- **Good:** provides a copy-paste canonical pattern for future D6 table authors. The per-table role-gate table above is the reference.
- **Good:** `deviation` role gate closes the "silent suppression" attack vector (employee deletes own deviation record) without breaking the day-control manager flow.
- **Neutral:** UPDATE policies on `session_task` are now manager+ for INSERT but any-member for UPDATE. This asymmetry is intentional (employees mark tasks complete; they don't create them). Future audits should treat this as documented, not a gap.
- **Bad:** small boilerplate cost per new D6 table (4 policies instead of 1). Acceptable — the forgery risk on `FOR ALL` is higher than the authoring friction.

## Status

proposed
