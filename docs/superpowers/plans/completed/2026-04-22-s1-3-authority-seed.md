---
title: "S1.3 Sub-Sortie Brief — journey capability authority seed migration"
status: approved
updated: 2026-04-22
created: 2026-04-22
module: journey-engine
tags: [sub-sortie, m1, migrations, authority, c4, cve-class]
---

# S1.3 — Authority seed migration for 4 journey capabilities

> **Campaign:** journey-engine · **Milestone:** M1 Foundations · **Sub-sortie:** S1.3
> **Predecessors:** S1.1 (merged `05b827b1`), S1.2 (merged `eef0b78d`)
> **Blocks:** S1.4 (per Gate A Steward condition C-1 + Supervisor condition: seed must deploy BEFORE capability registration)
> **Trust-Gate Unblock closed:** #3 (C4 authority seed migration)
> **Binding ADR:** 0173 (capability model), 0176 (authority seed)
> **Binding learning:** L-0066, L-0097 (authority default-allow CVE class)

---

## Why this sub-sortie must land before S1.4 (CVE-class)

The unified_authority_gate RPC at `supabase/migrations/20260506120000_gate_action_accept_entity_id.sql:45-161` treats a missing `engine_authority_config` row as `allow=true`. This is structural: `SELECT level INTO v_level FROM engine_authority_config WHERE …` returns NULL when no row exists, and the default branch at lines 107-121 falls through to `v_allow := true`.

If S1.4 registers the 4 journey capabilities in `CapabilityName` union and wires them into tool-selector BEFORE S1.3 seeds `engine_authority_config` rows, ANY workspace can execute any journey capability in the gap window. That's the exact CVE-class trap L-0066 + L-0097 flag.

**Gate A verdict (Steward C-1 + Supervisor #2/#3):** S1.3 must land on campaign and deploy to preview before S1.4 opens a PR. Not same-commit — strictly sequenced.

## Scope — exactly what lands

**One migration file.** No code changes outside migrations. Type regeneration follows.

### Migration

Base timestamp: strictly greater than current tip. Current tip after S1.2 is `20260516000300_journey_version_status_0c_tighten.sql`. This migration lands at `20260516000400_journey_authority_seed.sql`.

**Verify before writing:** `ls -1 supabase/migrations/ | sort | tail -6`. Adjust base timestamp if anything newer has landed on campaign since S1.2.

### Migration content

Idempotent CROSS JOIN pattern per existing `20260515110000_seed_day_control_authority.sql` (reference; read for pattern). Seeds 4 rows per workspace × 4 capabilities.

```sql
-- Header block (purpose, ADR, rollback, risk, dependencies, column schema notes)

INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  observer_escalation_hours,
  updated_by
)
SELECT
  w.workspace_id,
  v.capability,
  v.level::authority_level,
  v.min_role::workspace_role,
  v.requires_four_eyes,
  v.observer_escalation_hours,
  NULL::uuid  -- platform seed, no human actor
FROM public.workspace w
CROSS JOIN (
  VALUES
    ('journey.run_dev',          'suggest',    'admin',    false, NULL::int),
    ('journey.publish_mission',  'suggest',    'admin',    false, NULL::int),
    ('journey.publish_guide',    'suggest',    'admin',    false, NULL::int),
    ('journey.run_guided',       'autonomous', 'employee', false, NULL::int)
) AS v(capability, level, min_role, requires_four_eyes, observer_escalation_hours)
ON CONFLICT (workspace_id, capability) DO NOTHING;
```

### Column completeness (Gate A Supervisor condition)

Verify the `engine_authority_config` table has these exact columns with these types before writing the INSERT:

Run (in your verification step): `psql … -c "\d public.engine_authority_config"`

Required columns per ADR-0176 + campaign CLAUDE.md:
- `workspace_id uuid NOT NULL`
- `capability text NOT NULL` (or capability_name enum — verify)
- `level authority_level NOT NULL` (enum: autonomous/confirm/suggest/read_only/disabled)
- `min_role workspace_role` (enum; nullable per 20260410 ALTER)
- `requires_four_eyes boolean NOT NULL DEFAULT false` (per 20260415120400)
- `observer_escalation_hours int` (nullable, per 20260415120400)
- `updated_by uuid` (nullable, platform seed = NULL)

If column names or types differ from what's listed here, STOP and flag — do not invent. The plan assumes the schema per commit `20260415120400`; if newer ALTERs have landed, update the INSERT accordingly and note in the handoff.

### Rollback block

```sql
-- ROLLBACK (for reference, not auto-executed):
--   DELETE FROM public.engine_authority_config
--    WHERE capability IN (
--      'journey.run_dev',
--      'journey.publish_mission',
--      'journey.publish_guide',
--      'journey.run_guided'
--    );
```

## Out of scope

- **DO NOT** add capabilities to `CapabilityName` union — that's S1.4.
- **DO NOT** create `packages/ai/src/capabilities/journey/`.
- **DO NOT** touch `gate_action` RPC or any other authority-gate migration.
- **DO NOT** seed rows at runtime via Node/TypeScript — migration-only (L-0066 rule).
- **DO NOT** add more than the 4 capabilities listed (no journey.publish_inference, no journey.run_remote, etc.).

## Acceptance criteria (exit gates)

- [ ] `ls -1 supabase/migrations/ | sort | tail -6` — shows `20260516000400_journey_authority_seed.sql` as latest
- [ ] Migration timestamp strictly > `20260516000300` (L-0042)
- [ ] Migration has header comment with purpose, ADR refs, rollback, risk, dependencies
- [ ] Migration has `ON CONFLICT DO NOTHING` — idempotent
- [ ] `npx supabase db reset` completes cleanly
- [ ] Sanity via psql: after reset, every workspace has exactly 4 journey rows:
  - `SELECT capability, level, min_role FROM engine_authority_config WHERE capability LIKE 'journey.%' GROUP BY capability, level, min_role;`
  - expect 4 distinct capability rows, levels suggest/suggest/suggest/autonomous, min_roles admin/admin/admin/employee
- [ ] Sanity via psql: `SELECT COUNT(*) FROM engine_authority_config WHERE capability LIKE 'journey.%'` = `(number of workspaces) * 4`
- [ ] `pnpm turbo typecheck` passes with 0 errors (no type regeneration needed — no schema change)
- [ ] Handoff at `docs/HANDOFF-journey-s1-3-authority-seed.md` with: migration content rationale, column schema verification output, row-count sanity, decision log pointer
- [ ] User journey doc at `docs/journeys/JOURNEY-journey-s1-3-authority-seed.md` — operator flow: new workspace bootstraps with authority rows, admin views them via a query, confirms runtime authority gate respects them
- [ ] Decision log entry: "ADR-0176 landed — `engine_authority_config` seeded for 4 journey capabilities. Seed-before-capability merge ordering enforced per Gate A C-1."

## Coordination notes

- After S1.3 merges to campaign, orchestrator pushes campaign/journey-engine to origin — the seed must land remotely before S1.4 opens a PR. Document the push SHA in the handoff.
- S1.4 will read this seed to prove capability→authority wiring round-trips.
- Gate A Steward C-3: S1.4 (not S1.3) adds the ADR-0134 compliance test that `actor_id` + `workspace_id` are non-null before emit. S1.3 is schema-only — no emit paths exist yet.

## Dispatch

Single build subagent. Return handoff for orchestrator verification.
