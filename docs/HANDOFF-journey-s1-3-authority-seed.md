---
title: "Handoff — S1.3 journey capability authority seed"
status: done
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [handoff, s1-3, m1, migrations, authority, c4, adr-0176]
---

# HANDOFF — S1.3 Journey Capability Authority Seed

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.3
> **Branch:** `feat/journey-engine-journey-s1-3-authority-seed` (based on `campaign/journey-engine`, tip `42cf7b1b`)
> **Brief:** `docs/superpowers/plans/2026-04-22-s1-3-authority-seed.md`
> **Predecessors:** S1.1 (merged `05b827b1`), S1.2 (merged `eef0b78d`)
> **Blocks:** S1.4 (seed-before-capability ordering per Gate A C-1)
> **Trust-Gate Unblock closed:** #3 (C4 authority seed migration)
> **Binding ADRs:** 0173 (capability model), 0176 (authority seed)
> **Binding learnings:** L-0066 / L-0097 (authority default-allow CVE class)

## Summary

S1.3 seeds `public.engine_authority_config` with one row per (workspace × capability) for the four journey capabilities defined in ADR-0173. Pure-migration sub-sortie — no application code, no type regeneration, no capability registration.

The migration closes Trust-Gate Unblock #3 (`C4 authority seed migration`) and is the final schema prerequisite before S1.4 registers the four capabilities in the `CapabilityName` union. Seed-before-capability ordering is CVE-class per Gate A Steward condition C-1 + Supervisor conditions #2/#3: the `gate_action` RPC default-allows any capability whose `engine_authority_config` row is missing (`supabase/migrations/20260506120000_gate_action_accept_entity_id.sql:107-109`). Registering capabilities before seeding authority opens the allow-any-capability window L-0066 / L-0097 warn about.

### What changed

**Migration (1 file):**

- `supabase/migrations/20260516000400_journey_authority_seed.sql` — `INSERT … SELECT … FROM public.workspace CROSS JOIN (VALUES …) ON CONFLICT (workspace_id, capability) DO NOTHING`. Header block documents purpose, ADR refs, column schema verification, deviations from brief, risk, dependencies, rollback.

**Docs (3 files):**

- `docs/HANDOFF-journey-s1-3-authority-seed.md` (this file).
- `docs/journeys/JOURNEY-journey-s1-3-authority-seed.md`.
- `docs/decisions/0000-decision-log.md` — ADR-0176 landing note appended.

### What did NOT change (out of scope — per brief)

- `packages/ai/src/capabilities/journey/` skeletons — S1.4.
- `CapabilityName` union in `packages/ai/src/capabilities/types.ts` — S1.4.
- `packages/telemetry/src/registry.ts` — owned by S1.1 (already landed).
- `public.gate_action` RPC — untouched (the structural default-allow is the very reason S1.3 exists; fixing the RPC default to `deny` is a separate, larger ADR).
- `database.types.ts` — not regenerated. Rows seeded, but no schema shape change.
- No runtime `INSERT` logic added anywhere — seeding is migration-only per L-0066.

## Migration content — decisions and deviations from the brief

The brief's VALUES clause listed two constructs that do not match the live schema. Brief §Column completeness explicitly authorised deviation with a handoff note when schema differs; this section documents what changed and why.

### D1. Dropped `::authority_level` / `::workspace_role` enum casts

**Context.** Brief §Migration content wrote `v.level::authority_level` and `v.min_role::workspace_role`.

**Reality.** `\d public.engine_authority_config` shows:

```
 level     | text    |  | not null | 'read_only'::text
 min_role  | text    |  | not null | 'employee'::text
```

Both columns are plain `text` with CHECK constraints (`level IN ('autonomous','confirm','suggest','read_only','disabled')`, `min_role IN ('employee','manager','admin','owner')`). No `authority_level` or `workspace_role` Postgres enum exists. The casts would fail with `type "authority_level" does not exist`.

**Decision.** Insert plain text values; the CHECK constraints guarantee correctness. All precedent seeds (`billing_query`, `day_control`, `helpdesk_query`) do the same.

### D2. `observer_escalation_hours = 72` instead of `NULL::int`

**Context.** Brief §Migration content wrote `NULL::int` for observer_escalation_hours.

**Reality.** Column is `integer NOT NULL DEFAULT 72` per migration `20260415120400_authority_config_four_eyes.sql`. `NULL` violates NOT NULL and the migration would abort with `23502 not_null_violation`.

**Decision.** Use `72`. That value:
- Matches the column default, so operationally equivalent to "default".
- Matches the existing `helpdesk_query` seed (which also used `72`).
- Has no effect on journey capabilities today — no observer-escalation workflow is bound to any journey capability. The column is a placeholder for future four-eyes/observer work.

### D3. `requires_four_eyes = false` — explicit

Kept as in brief. All four journey capabilities ship without four-eyes today. If a future policy tightens `journey.publish_mission` (admin-scoped publish), it can flip via an admin UI or a later migration.

### D4. `updated_by = NULL::uuid`

Kept as in brief. Per `20260414225000_engine_authority_config_updated_by_nullable.sql`, system-seeded rows legitimately have no human actor. The FK is preserved — NULL is allowed.

## Column schema verification output

```
                             Table "public.engine_authority_config"
          Column           |           Type           | Collation | Nullable |      Default
---------------------------+--------------------------+-----------+----------+-------------------
 id                        | uuid                     |           | not null | gen_random_uuid()
 workspace_id              | uuid                     |           | not null |
 capability                | text                     |           | not null |
 level                     | text                     |           | not null | 'read_only'::text
 updated_by                | uuid                     |           |          |
 created_at                | timestamp with time zone |           | not null | now()
 updated_at                | timestamp with time zone |           | not null | now()
 min_role                  | text                     |           | not null | 'employee'::text
 requires_four_eyes        | boolean                  |           | not null | false
 observer_escalation_hours | integer                  |           | not null | 72
Indexes:
    "engine_authority_config_pkey" PRIMARY KEY, btree (id)
    "idx_authority_workspace" btree (workspace_id)
    "uq_workspace_capability" UNIQUE CONSTRAINT, btree (workspace_id, capability)
Check constraints:
    "engine_authority_config_level_check" CHECK (level = ANY (ARRAY['autonomous'::text, 'confirm'::text, 'suggest'::text, 'read_only'::text, 'disabled'::text]))
    "engine_authority_config_min_role_check" CHECK (min_role = ANY (ARRAY['employee'::text, 'manager'::text, 'admin'::text, 'owner'::text]))
Foreign-key constraints:
    "engine_authority_config_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES user_identity(user_id)
    "engine_authority_config_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspace(workspace_id) ON DELETE CASCADE
```

INSERT column list (`workspace_id, capability, level, min_role, requires_four_eyes, observer_escalation_hours, updated_by`) matches exactly. Unique constraint `uq_workspace_capability (workspace_id, capability)` confirms ON CONFLICT target.

## Row-count sanity

Local-DB `db reset` runs migrations on an empty schema, then `supabase/seed.sql` populates the test workspace. The seed migration therefore inserts 0 rows at first reset — workspaces do not yet exist. Precedent migrations (`billing_query_authority_seed`, `day_control_authority`, `helpdesk_query_authority_seed`) all share this pattern. In prod/preview the migration fires after workspaces exist, so rows insert.

To verify the INSERT shape works, the migration was re-executed manually against the post-seed DB state:

```
$ docker exec -i supabase_db psql -U postgres -f supabase/migrations/20260516000400_journey_authority_seed.sql
SET
INSERT 0 4
COMMENT
```

Post-run query:

```
       capability        |   level    | min_role | requires_four_eyes | observer_escalation_hours
-------------------------+------------+----------+--------------------+---------------------------
 journey.publish_guide   | suggest    | admin    | f                  |                        72
 journey.publish_mission | suggest    | admin    | f                  |                        72
 journey.run_dev         | suggest    | admin    | f                  |                        72
 journey.run_guided      | autonomous | employee | f                  |                        72
(4 rows)
```

COUNT = 4 = (1 workspace) × (4 capabilities). Re-running the migration produces `INSERT 0 0` (ON CONFLICT trips), confirming idempotence — no duplicate rows.

### Operational follow-up (out of scope for S1.3, flagged for orchestrator)

Because `seed.sql` owns workspace provisioning on local and runs after migrations, local developers will not see journey authority rows after a clean `db reset`. Two options exist for future sub-sorties:

1. **Extend `seed.sql` §15 "ENGINE — Authority Config"** to include journey rows alongside `schedule.read`, `contract.generate`, etc. This mirrors existing local-seed fidelity.
2. **Land a local-only re-seed helper** (e.g. a `DO $$` after `seed.sql` loads, or a dev-side script). Heavier, not justified by S1.3 alone.

Option 1 is the clear choice and is tracked as a follow-up — but it is NOT required by S1.3 exit criteria. Prod/preview deployments do insert correctly.

## 8 Verification-gate outputs

**Gate 1 — migration timestamp is tip and > 20260516000300:**

```
$ ls -1 supabase/migrations/ | sort | tail -6
20260516000000_journey_version_table.sql
20260516000100_journey_version_status_0a_widen.sql
20260516000200_journey_version_status_0b_enum.sql
20260516000300_journey_version_status_0c_tighten.sql
20260516000400_journey_authority_seed.sql
rollback
```

`20260516000400 > 20260516000300`. ✅

**Gate 2 — column schema verification (psql `\d`):** See "Column schema verification output" above. INSERT column list matches exactly. ✅

**Gate 3 — all migrations touching `engine_authority_config`:**

```
supabase/migrations/20260302000100_engine_authority_config.sql               (base table)
supabase/migrations/20260314000000_guardian_signal.sql                       (cross-ref only)
supabase/migrations/20260329200001_engine_fk_cascade.sql                     (FK CASCADE)
supabase/migrations/20260410000001_add_min_role_to_authority_config.sql      (min_role column)
supabase/migrations/20260414225000_engine_authority_config_updated_by_nullable.sql  (drop NOT NULL updated_by)
supabase/migrations/20260414230000_ops_intelligence_foundations.sql          (cross-ref only)
supabase/migrations/20260415120400_authority_config_four_eyes.sql            (requires_four_eyes + observer_escalation_hours)
supabase/migrations/20260417170000_billing_query_authority_seed.sql          (precedent seed)
supabase/migrations/20260505110000_unified_authority_gate.sql                (RPC wiring)
supabase/migrations/20260506110000_gate_action_four_eyes.sql                 (RPC wiring)
supabase/migrations/20260506120000_gate_action_accept_entity_id.sql          (RPC default-allow trap @ lines 107-109)
supabase/migrations/20260509100000_gate_action_four_eyes_history.sql         (RPC wiring)
supabase/migrations/20260515110000_seed_day_control_authority.sql            (precedent seed pattern)
supabase/migrations/20260515130300_helpdesk_query_authority_seed.sql         (precedent seed)
supabase/migrations/20260515130500_seed_session_authority.sql                (precedent seed)
```

All column-adding ALTERs accounted for in header block. ✅

**Gate 4 — `npx supabase db reset` clean:** Applied 166+ migrations without error. The new migration logs `Applying migration 20260516000400_journey_authority_seed.sql...` with no error line. Final line: `Finished supabase db reset on branch main.` ✅

**Gate 5 — journey.* rows after re-run against seeded DB:**

```
       capability        |   level    | min_role | requires_four_eyes | observer_escalation_hours
-------------------------+------------+----------+--------------------+---------------------------
 journey.publish_guide   | suggest    | admin    | f                  |                        72
 journey.publish_mission | suggest    | admin    | f                  |                        72
 journey.run_dev         | suggest    | admin    | f                  |                        72
 journey.run_guided      | autonomous | employee | f                  |                        72
(4 rows)
```

Levels suggest/suggest/suggest/autonomous ✅. Min_roles admin/admin/admin/employee ✅.

**Gate 6 — count journey.* rows:**

```
$ SELECT COUNT(*) FROM public.engine_authority_config WHERE capability LIKE 'journey.%';
 count
-------
     4
```

= 4 = (1 workspace) × (4 capabilities). ✅

**Gate 7 — workspace count cross-check:**

```
$ SELECT COUNT(*) FROM public.workspace;
 count
-------
     1
```

Matches. ✅

**Gate 8 — `pnpm typecheck` (project script for `turbo run typecheck`):**

```
Tasks:    33 successful, 33 total
Cached:    33 cached, 33 total
  Time:    4.14s >>> FULL TURBO
```

0 errors across 33 workspace packages. ✅

## Decisions (new this sub-sortie)

### D1. Drop brief's enum casts (text-with-CHECK reality)

**Context.** Brief VALUES used `::authority_level` and `::workspace_role` casts.

**Decision.** Drop both casts. Live schema is text-with-CHECK, no enums exist. Consistent with all precedent seeds.

**Alternatives considered.** 
- Introduce new Postgres enums (`authority_level`, `workspace_role`) and migrate the column types. Rejected — larger scope, breaks an entire RPC contract (`gate_action` compares text), out of sub-sortie bounds.

### D2. `observer_escalation_hours = 72` (column default), not `NULL`

**Context.** Brief specified `NULL::int`; column is `NOT NULL DEFAULT 72`.

**Decision.** Use 72. Equivalent to default, matches `helpdesk_query` precedent, has no effect on journey capabilities (no observer workflow bound).

**Alternatives considered.**
- Alter column to nullable first. Rejected — out of scope, changes gate_action contract surface, not required by ADR-0176.
- Use 24 (matches `billing_query`, `day_control`). Rejected — 72 matches column default and the most recent seed (`helpdesk_query`). Either is correct; 72 is slightly more conservative / default-matching.

### D3. Migration-only — no runtime seed, no app-code changes

**Context.** Brief §Out of scope explicitly prohibits runtime inserts and capability registration.

**Decision.** Ship one migration file plus docs. No type regeneration (no schema change, only data).

## Learnings (candidates worth capturing)

### L-candidate-1. Brief's "assumed schema" drift from live schema is real and expected

**Observation.** The brief (§Column completeness) cited schema as of commit `20260415120400` and flagged that newer ALTERs might land. No newer column-adding ALTER landed, but the brief also didn't reconcile its own VALUES with the NOT NULL constraint introduced in that very migration. The `NULL::int` + `::authority_level` cast are holdovers from a pre-realistic mental model.

**Action taken.** Followed brief's escape hatch: "If column names or types differ from what's listed here, STOP and flag — do not invent … update the INSERT accordingly and note in the handoff." Resolved in D1/D2. Reinforces that plans should always be sanity-checked against live `\d` before execution, even when authored in the same campaign.

**Promotion signal.** This is L-0045 + L-0096 (code-trace catches schema fiction) again, 3rd occurrence in this campaign. Pattern is stable — plan writers must verify schema before finalising VALUES.

### L-candidate-2. Local-DB seed-timing means seed migrations appear inert at `db reset`

**Observation.** `supabase db reset` runs migrations against an empty schema, then loads `supabase/seed.sql`. Seed migrations that target `public.workspace` insert 0 rows at first reset — the workspace doesn't exist yet. Local devs who run `SELECT * FROM engine_authority_config WHERE capability LIKE 'journey.%'` post-reset see nothing.

**Action taken.** Documented in "Row-count sanity" above. Flagged follow-up: either extend `seed.sql` §15 with journey rows, or live with the gap (prod/preview are not affected).

**Promotion signal.** Precedent seeds (`billing_query_authority_seed`, `day_control`, `helpdesk_query_authority_seed`) all have the same gap — no local fallback. This is a local-developer UX bug, not a prod-correctness bug, and is probably worth a dedicated learning if S1.4 hits it.

## Known issues / debt

1. **`seed.sql` §15 lags migrations** (see L-candidate-2). Local-dev UX gap — journey authority rows missing after `db reset`. Scoped to a follow-up.
2. **`gate_action` default-allow is structural CVE-class.** This sub-sortie seeds the 4 journey rows to close the gap for journey capabilities, but the RPC still default-allows any capability with no row. L-0066 + L-0097 own this. Resolving the default-deny contract needs its own ADR beyond journey-engine scope.
3. **Brief-vs-live schema drift** (see L-candidate-1). Future sub-sortie briefs should require a `\d` verification line in the plan itself, not just in execution.

## Next steps (handoff to orchestrator)

1. **Verify migration file + handoff docs land on campaign.** Orchestrator runs `close-feature.sh` to merge `feat/journey-engine-journey-s1-3-authority-seed` → `campaign/journey-engine`.
2. **Push to origin BEFORE S1.4 opens PR.** Gate A condition: seed must deploy to preview before capability registration opens. Document the push SHA in `CAMPAIGN-journey-engine.md §Trust-Gate Unblocks`.
3. **Flip ADR-0176 status.** Decision log entry below marks ADR-0176 `landed`. Move the ADR file frontmatter `status: proposed → accepted`.
4. **S1.4 pre-conditions.** S1.4 may now register the 4 capabilities in `CapabilityName` and create `packages/ai/src/capabilities/journey/` skeletons. S1.4 owns ADR-0134 compliance test (`actor_id` + `workspace_id` non-null before emit).
5. **Follow-up ticket (out of scope).** Extend `supabase/seed.sql` §15 with the 4 journey rows so local `db reset` workspace also sees the authority config.

## Decisions log pointer

```
| [ADR-0176 landed](0176-journey-c4-authority-seed.md) | 2026-04-22 | ADR-0176 landed — `engine_authority_config` seeded for 4 journey capabilities (`journey.run_dev`/`journey.publish_mission`/`journey.publish_guide` at `suggest`/`admin`; `journey.run_guided` at `autonomous`/`employee`). Migration `20260516000400_journey_authority_seed.sql` uses idempotent CROSS JOIN `workspace × VALUES` with `ON CONFLICT (workspace_id, capability) DO NOTHING`. Deviated from brief: dropped `::authority_level` / `::workspace_role` casts (columns are text-with-CHECK, no enums exist), used `observer_escalation_hours = 72` (column NOT NULL, not NULL as brief assumed). Seed-before-capability ordering enforced per Gate A C-1. Trust-Gate Unblock #3 closed. (Campaign journey-engine, Sub-sortie S1.3 2026-04-22) | landed |
```

## Trust-Gate unblock status — after S1.3

| # | Unblock condition | State after S1.3 |
|---|---|---|
| 1 | Telemetry registry exists | ✅ closed (S1.1) |
| 2 | Enum lifecycle migration | ✅ closed (S1.2) |
| 3 | C4 authority seed migration | **✅ closed (S1.3)** |
| 4 | Capability skeletons registered | ⏳ S1.4 |
| 5 | `packages/journey-ir` created | ⏳ M2 |
| 6 | `actor_id` resolution doc | ⏳ S1.4 + M2 |
| 7 | ADR-0074 unification delta spec | ⏳ M3 |

**M1 progress: 3 / 4 sub-sorties complete. S1.4 is the final M1 sub-sortie.**
