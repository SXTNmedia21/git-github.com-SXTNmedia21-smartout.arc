---
title: "PLAN-1 — Migrations M1 + M2 + M3 (department_id NOT NULL + CREATE shift_zone + backfill)"
sortie: adr-0430-shift-zone-m2m
plan: 1
tier: T3
phase: schema-foundation
created: 2026-05-28
status: pending
depends_on: [PLAN-0]
blocks: [PLAN-2, PLAN-3, PLAN-4]
estimated_effort_hours: 6-10
adr_rules_covered: [Rule 1, Rule 2 partial M1-M3, Rule 8 partial L-0064 marker-removal]
---

# PLAN-1 — Schema foundation (M1 + M2 + M3)

## Purpose

Ship the three additive/constraint-tightening migrations from ADR-0430 Rule 2:
- **M1** — backfill `schedule_shift.department_id` from `position`; ADD NOT NULL constraint; remove 2 Class-B L-0064 comment markers.
- **M2** — CREATE TABLE `shift_zone` with composite FK invariants + 5-policy RLS + workspace_id trigger.
- **M3** — backfill `shift_zone` from existing `shift_session_day_line` rows using PLAN-0 AC-0.7 default-zone rule.

M4 (DROP COLUMN) is **explicitly excluded** — ships in PLAN-4 only after code-rewrite green.

## Scope

### M1 — `schedule_shift.department_id` NOT NULL

```sql
-- supabase/migrations/<timestamp>_shift_dept_not_null_backfill.sql
-- Timestamp MUST be > 20260801000000 per Rule 2 + L-0042 correction note
BEGIN;

-- Backfill from position.department_id where shift has position_id
UPDATE schedule_shift s
SET department_id = p.department_id
FROM position p
WHERE s.position_id = p.id
  AND s.department_id IS NULL
  AND p.department_id IS NOT NULL;

-- Verify no remaining NULLs (M0.5 should have ensured this; failsafe)
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT count(*) INTO null_count FROM schedule_shift WHERE department_id IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'schedule_shift has % rows with NULL department_id — M0.5 reconciliation incomplete', null_count;
  END IF;
END $$;

ALTER TABLE schedule_shift ALTER COLUMN department_id SET NOT NULL;

COMMIT;
```

**Class-B L-0064 marker removal (separate code commit, same plan):**
- `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts:299` — remove L-0064 trap comment
- `apps/web/src/app/dashboard/_hooks/use-shift-day-stats.ts:18` — remove L-0064 trap comment

**DO NOT touch Class-A L-0064 markers** (per ADR Rule 8 — those are "Phase Enum UI-vs-DB Drift" derivation-helpers in 9 other files, NOT workarounds).

### M2 — CREATE TABLE `shift_zone`

```sql
-- supabase/migrations/<timestamp>_shift_zone_table.sql
-- Timestamp MUST be > <M1 timestamp> AND > 20260801000000
BEGIN;

-- Prerequisite (if PLAN-0 AC-0.10 flagged missing):
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_zone_id_location_id ON zone(id, location_id);
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_day_line_id_location_id ON day_line(id, location_id);

CREATE TABLE public.shift_zone (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  shift_session_id  UUID NOT NULL,
  day_line_id       UUID NOT NULL,
  zone_id           UUID NOT NULL,
  location_id       UUID NOT NULL,  -- denormalized for composite FK coherence (Rule 1)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite FK to shift_session_day_line(shift_session_id, day_line_id) — Rule 1
  CONSTRAINT fk_shift_zone_parent
    FOREIGN KEY (shift_session_id, day_line_id)
    REFERENCES shift_session_day_line(shift_session_id, day_line_id)
    ON DELETE CASCADE,

  -- Composite FK to zone(id, location_id) — enforces zone is in the denormalized location
  CONSTRAINT fk_shift_zone_zone
    FOREIGN KEY (zone_id, location_id)
    REFERENCES zone(id, location_id),

  -- Composite FK to day_line(id, location_id) — enforces day_line is in the denormalized location
  CONSTRAINT fk_shift_zone_day_line_location
    FOREIGN KEY (day_line_id, location_id)
    REFERENCES day_line(id, location_id),

  -- Prevent duplicate zone assignments per (shift_session, day_line)
  CONSTRAINT uq_shift_zone_per_dayline UNIQUE (shift_session_id, day_line_id, zone_id)
);

-- Indexes
CREATE INDEX ix_shift_zone_workspace ON shift_zone(workspace_id);
CREATE INDEX ix_shift_zone_session ON shift_zone(shift_session_id);
CREATE INDEX ix_shift_zone_day_line ON shift_zone(day_line_id);
CREATE INDEX ix_shift_zone_zone ON shift_zone(zone_id);

-- updated_at trigger (mirror project pattern)
CREATE TRIGGER trg_shift_zone_updated_at
  BEFORE UPDATE ON shift_zone
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — 5-policy mirror of department_location pattern (Rule 2 + workspace_id trigger)
ALTER TABLE shift_zone ENABLE ROW LEVEL SECURITY;

-- (a) JWT SELECT — workspace member
CREATE POLICY "shift_zone_select_jwt" ON shift_zone
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT * FROM get_workspace_ids_for_user()));

-- (b) JWT INSERT — admin in workspace (zone assignment is admin-authored per ADR-0133)
CREATE POLICY "shift_zone_insert_jwt" ON shift_zone
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_in_workspace(workspace_id));

-- (c) JWT UPDATE — admin (zone assignment immutable; UPDATE only via DELETE + INSERT in practice, but allow for back-office repair)
CREATE POLICY "shift_zone_update_jwt" ON shift_zone
  FOR UPDATE TO authenticated
  USING (is_admin_in_workspace(workspace_id))
  WITH CHECK (is_admin_in_workspace(workspace_id));

-- (d) JWT DELETE — admin
CREATE POLICY "shift_zone_delete_jwt" ON shift_zone
  FOR DELETE TO authenticated
  USING (is_admin_in_workspace(workspace_id));

-- (e) API-KEY ALL — workspace-api gateway path (dual-auth per ADR-0039)
CREATE POLICY "shift_zone_api_key" ON shift_zone
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
```

**Composite FK invariant (Rule 1 enforcement):** Because `zone(id, location_id)` UNIQUE + `day_line(id, location_id)` UNIQUE both target the SAME `location_id` column on `shift_zone`, the only valid INSERT is one where `zone.location_id = day_line.location_id`. PostgreSQL enforces this at every write path including bulk INSERT, pg_dump/restore, and `session_replication_role = replica` — exactly as ADR-0430 §Rule 1 specifies.

### M3 — Backfill `shift_zone` from existing rows

```sql
-- supabase/migrations/<timestamp>_shift_zone_backfill.sql
-- Timestamp MUST be > <M2 timestamp>
BEGIN;

-- Strategy: for each existing shift_session_day_line, attempt to assign default zone
-- (lowest sort_order per workspace_id+location_id). Skip if ambiguous or no zone exists.

WITH default_zone_per_location AS (
  SELECT DISTINCT ON (z.workspace_id, z.location_id)
    z.workspace_id,
    z.location_id,
    z.id AS zone_id,
    z.sort_order
  FROM zone z
  -- Tie-break exclusion: if two zones share lowest sort_order, NULL the row (SKIP it)
  -- Subquery filters out workspace+location pairs with ties on minimum sort_order
  WHERE NOT EXISTS (
    SELECT 1 FROM zone z2
    WHERE z2.workspace_id = z.workspace_id
      AND z2.location_id = z.location_id
      AND z2.id != z.id
      AND z2.sort_order = z.sort_order
  )
  ORDER BY z.workspace_id, z.location_id, z.sort_order ASC
)
INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
SELECT
  ssdl.workspace_id,
  ssdl.shift_session_id,
  ssdl.day_line_id,
  dz.zone_id,
  dl.location_id
FROM shift_session_day_line ssdl
JOIN day_line dl ON dl.id = ssdl.day_line_id
JOIN default_zone_per_location dz
  ON dz.workspace_id = ssdl.workspace_id
  AND dz.location_id = dl.location_id
ON CONFLICT (shift_session_id, day_line_id, zone_id) DO NOTHING;

-- Log skipped rows (no default zone resolvable)
DO $$
DECLARE
  total_ssdl int;
  backfilled int;
BEGIN
  SELECT count(*) INTO total_ssdl FROM shift_session_day_line;
  SELECT count(DISTINCT (shift_session_id, day_line_id)) INTO backfilled FROM shift_zone;
  RAISE NOTICE 'M3 backfill: % shift_session_day_line rows total, % junction-keys received shift_zone rows (% skipped — no default zone resolvable)', total_ssdl, backfilled, total_ssdl - backfilled;
END $$;

COMMIT;
```

## Falsifiable acceptance criteria

| AC | Check | Pass condition |
|----|-------|----------------|
| AC-1.1 | M1 applied | `\d schedule_shift` shows `department_id` as `not null` |
| AC-1.2 | M1 backfill complete | `SELECT count(*) FROM schedule_shift WHERE department_id IS NULL` returns 0 |
| AC-1.3 | L-0064 markers removed | `grep -c "L-0064" apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts apps/web/src/app/dashboard/_hooks/use-shift-day-stats.ts` returns 0+0 |
| AC-1.4 | Class-A L-0064 markers untouched | `grep -c "L-0064" packages/utils/src/cascade/derive-phase.ts packages/ai/src/capabilities/communication/{tools,compile-day-brief,compile-preclose}.ts packages/ai/src/capabilities/operations/tools.ts packages/telemetry/src/registry.ts apps/web/src/components/day/WebDayControl.tsx apps/web/src/app/dashboard/_hooks/use-daily-reconciliation.ts apps/web/src/app/dashboard/_actions/toggle-session-task-action.ts` returns 9+ hits (per ADR Rule 8 §Class A canonical) |
| AC-1.5 | M2 applied | `\d shift_zone` shows table with 7 columns (id, workspace_id, shift_session_id, day_line_id, zone_id, location_id, created_at, updated_at) + 3 composite FKs + 5 RLS policies |
| AC-1.6 | M2 RLS active | `SELECT count(*) FROM pg_policies WHERE tablename = 'shift_zone'` returns 5 |
| AC-1.7 | M2 composite FK invariant works | Manual test: INSERT with mismatched `zone.location_id ≠ day_line.location_id` raises FK violation |
| AC-1.8 | M3 backfill ran | `\d shift_zone` `SELECT count(*) FROM shift_zone` returns ≥ 0 rows; log shows N total ssdl, M backfilled, N-M skipped |
| AC-1.9 | M3 skip-on-tie behavior | Manual test against seeded data with two zones tied on sort_order for same location: that location's shift_session_day_lines are NOT backfilled, log notice emitted |
| AC-1.10 | typegen post-M2 | `supabase gen types --local` produces non-empty `shift_zone` interface in `database.types.ts`; commit type regen separately |
| AC-1.11 | M1+M2+M3 idempotent | Apply, reset, re-apply — same final state |
| AC-1.12 | Continuous E2E green | `pnpm turbo test --filter='@smartout/web...'` and `pnpm exec playwright test apps/e2e/scheduling/` PASS unchanged (no app code touches `shift_zone` yet) |

## Risk

| Risk | Severity | Mitigation |
|------|----------|------------|
| M1 fails on NULL department_id remaining (PLAN-0 AC-0.6 incomplete) | HIGH — migration aborts | Re-run M0.5 reconciliation; do NOT add fallback `department_id = 'default-uuid'` (data lie) |
| M2 composite FK fails due to missing UNIQUE on zone(id, location_id) | HIGH — migration aborts | PLAN-0 AC-0.10 must catch this; if missed, add `CREATE UNIQUE INDEX CONCURRENTLY` prelude to M2 |
| M3 backfill mis-assigns zone (default not actually correct for that workspace) | MEDIUM — data quality | Skip-on-tie + skip-on-no-zone defaults to "leave unassigned" rather than "assign wrong". PLAN-3 WRITE-rewrite UI will let admins assign zones going forward. |
| Pre-merge schema drift (campaign branches diverged) | MEDIUM | PLAN-0 AC-0.4 timestamp collision check. If campaign branch claims `20260802000000`, reschedule M1 timestamp. |
| RLS policy mistake hides shift_zone from workspace members | LOW — caught in PLAN-2 READ tests | Manual smoke: `supabase db reset` → seed → `set role authenticated` → `SELECT FROM shift_zone` returns rows |

## Dependencies

- **PLAN-0** must pass all 10 ACs.
- **No code dependencies** — schema-only sortie. App code unchanged until PLAN-2.

## Files to touch

- **Create:** `supabase/migrations/<ts>_shift_dept_not_null_backfill.sql` (M1)
- **Create:** `supabase/migrations/<ts>_shift_zone_table.sql` (M2)
- **Create:** `supabase/migrations/<ts>_shift_zone_backfill.sql` (M3)
- **Edit:** `apps/web/src/app/dashboard/_hooks/use-day-timeline-events.ts` (remove L-0064 comment)
- **Edit:** `apps/web/src/app/dashboard/_hooks/use-shift-day-stats.ts` (remove L-0064 comment)
- **Regenerated:** `packages/supabase/dist/database.types.ts` (commit after M2 + M3 applied locally)
- **Decision log:** Append M1+M2+M3 entries to `docs/decisions/0000-decision-log.md`

## Validation gate (must pass before PLAN-2 ships)

All 12 ACs PASS. `pnpm turbo typecheck` green. Local Supabase reset + apply + gen-types + typecheck cycle passes.

## Notes

- Migrations are forward-only per ADR-0427. No rollback migrations.
- M2 RLS uses `is_admin_in_workspace()` for write — zone assignment is admin-authored per ADR-0133 (mobile read-only).
- M3 is the ONLY migration that runs on existing data; M1 and M2 are constraint + DDL only. M3 explicitly accepts a "lossy" backfill (skip-on-tie, skip-on-no-zone) per ADR Bad-consequence #3.
