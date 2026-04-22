---
title: "Journey — S1.3 journey capability authority seed"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [journey, s1-3, m1, authority, c4, admin-flow]
---

# JOURNEY — Journey Capability Authority Seed (S1.3)

> **Sub-sortie:** S1.3 · **Campaign:** journey-engine · **Milestone:** M1.
>
> This sub-sortie is schema-only: no UI, no API, no capability call-sites, no runtime tools. The journeys below describe what happens INSIDE the database and RPC when the migration lands, and what operators can observe via direct SQL. Later sub-sorties (S1.4 capability registration, M4 authoring UI) will surface this seed to real users.

---

## Journey A: New (or existing) workspace bootstraps with 4 journey authority rows

**Role:** platform operator / deploy automation (not a human UI flow).
**Surface (direct DB):** `supabase/migrations/20260516000400_journey_authority_seed.sql` runs during `supabase db push` (prod/preview) or `supabase db reset` (local, if workspace already exists at migration time — see error-path A.3 below).
**Precondition:** the migration has landed on the branch. At least one row exists in `public.workspace` (or gets inserted later via `seed.sql` / workspace-provisioning code).

1. Deploy automation runs `supabase db push`.
   - → Supabase CLI applies all migrations in lexicographic timestamp order.
   - → When it reaches `20260516000400_journey_authority_seed.sql`, it executes:
     - `INSERT INTO public.engine_authority_config (workspace_id, capability, level, min_role, requires_four_eyes, observer_escalation_hours, updated_by) SELECT w.workspace_id, v.capability, v.level, v.min_role, v.requires_four_eyes, v.observer_escalation_hours, NULL FROM public.workspace w CROSS JOIN (VALUES …) AS v ON CONFLICT DO NOTHING`.
   - → For each existing workspace, 4 rows are inserted — one per journey capability.
   - → For workspaces that already have one or more of the journey rows (e.g. patched manually), `ON CONFLICT (workspace_id, capability) DO NOTHING` preserves the existing row.
2. Deploy operator verifies via psql (or Supabase dashboard):
   ```sql
   SELECT capability, level, min_role, requires_four_eyes, observer_escalation_hours
   FROM public.engine_authority_config
   WHERE capability LIKE 'journey.%'
   ORDER BY workspace_id, capability;
   ```
   - → System returns (N workspaces × 4 rows) with the values below.
3. Operator sees exactly four distinct capabilities per workspace:
   - `journey.publish_guide` → `level=suggest`, `min_role=admin`, `requires_four_eyes=false`, `observer_escalation_hours=72`
   - `journey.publish_mission` → `level=suggest`, `min_role=admin`, `requires_four_eyes=false`, `observer_escalation_hours=72`
   - `journey.run_dev` → `level=suggest`, `min_role=admin`, `requires_four_eyes=false`, `observer_escalation_hours=72`
   - `journey.run_guided` → `level=autonomous`, `min_role=employee`, `requires_four_eyes=false`, `observer_escalation_hours=72`

**Postcondition:** every workspace that existed at migration time has exactly 4 `engine_authority_config` rows for journey capabilities; these rows cause `public.gate_action` to compute explicit authority decisions (rather than default-allow) when the 4 capabilities are invoked in S1.4+.

**Error paths:**
- **A.1. `engine_authority_config` table missing.** → Migration fails with `42P01 undefined_table`. Cannot happen on the campaign branch (base migration `20260302000100` is present).
- **A.2. `uq_workspace_capability` unique constraint missing.** → `ON CONFLICT (workspace_id, capability)` fails with `42P10 invalid_column_reference`. Cannot happen on the campaign branch (constraint lives in base migration). This was a specific concern from the brief — verified present.
- **A.3. No workspaces exist at migration time (local `db reset`).** → `SELECT … FROM public.workspace … CROSS JOIN …` returns zero rows. `INSERT 0 0`. No error, no seed. On local, workspaces land later via `supabase/seed.sql`, at which point the migration has already run — no journey rows seeded locally. Prod/preview unaffected. Follow-up: extend `seed.sql` §15 with journey rows (out of scope for S1.3; flagged in handoff).
- **A.4. CHECK constraint violation** (e.g. typo in `level` value). → `23514 check_violation`. Not possible with the hardcoded VALUES in the migration — all 4 values (`suggest`, `autonomous`) pass `level_check`, all 4 min_roles (`admin`, `employee`) pass `min_role_check`.
- **A.5. NOT NULL violation** on `observer_escalation_hours`. → `23502 not_null_violation`. Not possible — explicit `72` supplied.
- **A.6. FK violation on `workspace_id`.** → Impossible: the `SELECT` pulls from `public.workspace` directly, so every value is a valid FK.

---

## Journey B: Admin inspects journey authority configuration via direct SQL

**Role:** platform admin (godmode) or workspace admin with access to the `admin_manage_authority` RLS policy.
**Surface (direct DB today; admin UI in future work):** `SELECT` from `public.engine_authority_config`.
**Precondition:** admin is authenticated with a JWT whose `auth.uid()` resolves to a `profile` row with `role IN ('admin', 'owner')` and `is_active = true`, for the target workspace.

1. Admin opens Supabase Studio (or psql with a service-role key) and runs:
   ```sql
   SELECT capability, level, min_role, requires_four_eyes
   FROM public.engine_authority_config
   WHERE workspace_id = '<my-workspace-uuid>'
     AND capability LIKE 'journey.%'
   ORDER BY capability;
   ```
   - → RLS policy `admin_manage_authority` permits the read because admin's profile resolves inside the workspace.
2. System returns four rows:
   - `journey.publish_guide | suggest | admin | false`
   - `journey.publish_mission | suggest | admin | false`
   - `journey.run_dev | suggest | admin | false`
   - `journey.run_guided | autonomous | employee | false`
3. Admin confirms that `journey.run_guided` is the only autonomous capability (agent-guided end-user runs are allowed without per-invocation confirmation) and that the three authoring/publish capabilities are gated to `admin` role with `suggest` level (manual confirmation required).

**Postcondition:** admin has ground truth on which roles can exercise which journey capabilities at which authority level. No side effects — pure read.

**Error paths:**
- **B.1. Admin's profile does not carry `admin`/`owner` role.** → Zero rows returned (RLS filter trips). No error message — the policy is silent by design.
- **B.2. Admin scopes to a different workspace.** → Zero rows returned (policy limits to `workspace_id IN (profile.workspace_id)`).
- **B.3. API-key caller without `app.workspace_id` GUC set.** → `api_key_read_authority` policy filters to `NULL = <anything>` which is false — zero rows. Caller must set `SET app.workspace_id = '<uuid>';` in the session.

---

## Journey C: Runtime authority gate respects the seed when a journey capability is invoked (S1.4+ scenario — previewed here)

**Role:** agent runtime (engine-dispatch / stage-engine) OR a human caller via capability tool.
**Surface:** `public.gate_action(p_workspace_id, p_capability, …)` RPC.
**Precondition (will be true after S1.4):** a journey capability is registered in `packages/ai/src/capabilities/types.ts` and is invoked via a tool call that passes through `gate_action`.

1. Agent runtime resolves a tool call whose capability is `journey.run_guided`.
   - → Stage-engine (or agent-router) calls `gate_action(workspace_id, 'journey.run_guided', channel, actor_profile_id, 'step_reached', …)`.
2. `gate_action` looks up `engine_authority_config WHERE workspace_id=$1 AND capability='journey.run_guided'`.
   - → Row exists (S1.3 seeded it): `level='autonomous', min_role='employee', requires_four_eyes=false`.
3. `gate_action` evaluates:
   - `v_level = 'autonomous'` → not NULL → not disabled → permitted path.
   - Caller's role compared against `min_role='employee'` via `_role_rank()`. Any caller with role ≥ `employee` (i.e. all roles) passes the floor.
   - `requires_four_eyes=false` → single approver sufficient.
   - → `v_allow = true`, `v_downgrade_to = NULL`, `v_reason = NULL`.
4. `gate_action` writes a `gate_evaluation` audit row and returns `{allow: true, downgrade_to: null, min_role_required: 'employee', channel_allowed: true, reason: null, gate_evaluation_id: <uuid>, four_eyes_required: false, approvers_needed: 0, approvers_present: []}`.

**Contrast — `journey.publish_mission` invoked by a `manager`:**
1. `gate_action(workspace_id, 'journey.publish_mission', …)`.
2. Row exists: `level='suggest', min_role='admin', requires_four_eyes=false`.
3. `v_level = 'suggest'` → permitted path.
4. Caller's role `manager` vs `min_role='admin'`: `_role_rank('manager') < _role_rank('admin')` → true.
5. `v_downgrade_to := 'suggest'`, `v_reason := 'role_below_min'`.
6. Server Action / tool treats `downgrade_to='suggest'` as denied-with-suggestion (read-only surface); UI shows "You do not have permission to publish missions".

**Postcondition:** runtime behaviour matches the authority matrix defined by ADR-0173 and seeded by S1.3. Default-allow trap (CVE-class, L-0066/L-0097) is closed for journey capabilities because every workspace has an explicit row.

**Error paths (what WOULD happen if seed were missing — demonstrates why S1.3 matters):**
- **C.1. If workspace has no `engine_authority_config` row for a capability.** → `gate_action` lines 107-109 in `20260506120000_gate_action_accept_entity_id.sql`: `IF v_level IS NULL THEN v_allow := true;`. Caller is ALLOWED. This is the CVE-class default-allow. S1.3 closes this for journey capabilities.
- **C.2. If S1.4 registers a capability before S1.3 deploys.** → Capability is callable but no row exists → `gate_action` default-allows any caller regardless of role. This is the Gate A ordering trap — S1.3 must land + deploy to preview BEFORE S1.4 opens its PR.
- **C.3. Four-eyes requirement later added to `journey.publish_mission`.** → Admin UI writes `requires_four_eyes=true`; `gate_action` computes `v_four_eyes_required=true` and requires 2 approvers. Out of S1.3 scope.

---

## Journey D: Dev verifies seed idempotency during migration iteration

**Role:** platform engineer iterating on the migration (during development or code review).
**Surface:** `docker exec` + `psql` against local DB (or `npx supabase db push` against preview branch).

1. Engineer runs the seed migration once:
   ```bash
   docker exec -i $(docker ps -q -f name=supabase_db) psql -U postgres \
     -f supabase/migrations/20260516000400_journey_authority_seed.sql
   ```
   - → `INSERT 0 4` (or `INSERT 0 N*4` depending on workspace count).
2. Engineer re-runs the same migration:
   - → `INSERT 0 0`. Zero rows inserted, zero rows modified.
3. Engineer verifies `SELECT COUNT(*) FROM engine_authority_config WHERE capability LIKE 'journey.%'` is unchanged.

**Postcondition:** migration is safely replayable. `supabase db reset` is safe. Manual patches are safe. No duplicate rows.

**Error paths:**
- **D.1. Engineer alters a VALUE (e.g. `suggest` → `confirm`) and re-runs.** → `INSERT 0 0` still — ON CONFLICT wins. Existing rows are NOT updated. Engineer must write a follow-up migration with `ON CONFLICT … DO UPDATE` or a targeted `UPDATE`. This is intentional per ADR-0176 (admin UI writes override seed; seed is the floor).

---

## Summary — why this sub-sortie is a journey milestone

S1.3 is the minimum schema state for S1.4 to register journey capabilities without opening a CVE-class allow-any window. After S1.3:

- Every journey capability has a per-workspace authority row.
- Every row has explicit values (never default-allow).
- Migration is idempotent (replayable).
- `gate_action` will compute correct decisions the moment S1.4 wires the capabilities into the tool selector.

The operator-facing journeys are admin + deploy + dev — there is no end-user flow yet. End-users see the effect only once S1.4 registers capabilities and M4/M5 surface them in UI.
