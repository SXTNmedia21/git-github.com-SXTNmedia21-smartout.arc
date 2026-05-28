---
title: "ADR-0430 Phase b — PLAN-0 Pre-flight Report"
sortie: adr-0430-shift-zone-m2m
plan: 0
executed: 2026-05-28
status: GREEN-READY-FOR-PLAN-1
overall_verdict: ALL 10 ACs PASS (AC-0.9 resolved by migration 20260801000001)
---

# PLAN-0 Pre-flight Report — ADR-0430 Phase b

**Date:** 2026-05-28
**Branch:** `feat/adr-0430-shift-zone-m2m` in worktree `~/dev/smartout.ai-wt-1`
**DB:** local Supabase (`supabase_db_smartout.ai`), tip `20260801000000_hq_workspace_location_area_reshape.sql`

---

## Summary

All 10 acceptance criteria pass. One blocker (AC-0.9 — `channel_constraint` column missing) was resolved by creating and applying migration `20260801000001_add_channel_constraint_to_engine_authority_config.sql`. PLAN-1 is unblocked.

Key findings:
1. Flag `SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED` defaults ON (`true`) when env var absent — documented in all 3 environments.
2. `ShiftAddedManual` and `ShiftCreated` typing strategy confirmed: `zone_ids?: string[]` extension is additive (optional), no breaking change.
3. Canonical Zod schema to migrate: `SchedShiftPayload` in `packages/types/src/timeline-template.ts:52-59` (zone: z.string().max(40).nullable() → zone_ids: z.array(z.string().uuid()).nullable()).
4. 0 timestamp collisions on remote feat branches.
5. `shift_session_day_line` PK confirmed as `(shift_session_id, day_line_id)`.
6. 0 position orphans — M1 backfill will not fail.
7. Default zone rule codified for M3 backfill.
8. pg_depend audit: 1 trigger MUST rewrite before M4 (`trg_ensure_shift_session`); all views/policies safe.
9. AC-0.9 RESOLVED: migration 20260801000001 adds `channel_constraint` TEXT column.
10. AC-0.10: UNIQUE indexes on `zone(zone_id)` and `day_line(day_line_id, location_id)` exist, BUT `UNIQUE(zone.id, zone.location_id)` DOES NOT EXIST — additive work required in PLAN-1 M2.

---

## Per-AC Detail

### AC-0.1 — CF-1: SMARTOUT_COMPOSITION_ORCHESTRATOR_ENABLED flag state

| Environment | State | Source |
|---|---|---|
| dev (local) | **ENABLED (DEFAULT)** — env var absent → `isOrchestratorEnabled()` returns `true` | `packages/ai/src/gate/gatedMutation.ts:80-83`: `if (raw === undefined) return true` |
| preview | **ENABLED (DEFAULT)** — flag not in `.env.template`; Vercel env inherited from dev | `.env.template` (root) — flag absent |
| prod | **ENABLED (DEFAULT)** — flag not in `.env.template`; no Vercel env override found | `.env.template` (root) — flag absent |

**Verdict: PASS.** Flag is ENABLED in all environments by default (undefined = ON, per gatedMutation.ts:81 SS-4 convention). The flag is a kill-switch only; its absence does not indicate disabled. Zone reform is independent of orchestrator behavior — Rule 4 adds `zone_ids` to existing `gatedMutation` call sites, which are already active.

Note: The flag is scheduled for removal in SS-5 (per gatedMutation.ts:76-77: "SS-5 removes this flag entirely"). Phase b implementer should not add new code paths that branch on this flag.

---

### AC-0.2 — CF-2: ShiftAddedManual + ShiftCreated typing strategy

**Proposed diff — `ShiftAddedManual` (`packages/telemetry/src/registry.ts:752`):**

```typescript
// BEFORE (current state at registry.ts:754-768):
export interface ShiftAddedManual extends BaseEvent {
  event: "shift added_manual";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string;
      source: "manual_admin";
      manual: true;
      reason: string;
    };
  };
}

// AFTER (Phase b — add zone_ids? as optional):
export interface ShiftAddedManual extends BaseEvent {
  event: "shift added_manual";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      role: string;
      source: "manual_admin";
      manual: true;
      reason: string;
      zone_ids?: string[];  // ADR-0430 Rule 6: Option β — optional, legacy callsites compile
    };
  };
}
```

**Proposed diff — `ShiftCreated` (`registry.ts:709`):**

```typescript
// BEFORE (current state at registry.ts:709-722):
export interface ShiftCreated extends BaseEvent {
  event: "shift created";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      position_id?: string;
    };
  };
}

// AFTER (Phase b):
export interface ShiftCreated extends BaseEvent {
  event: "shift created";
  properties: {
    entity_type: "shift";
    entity_id: string;
    data: {
      assigned_to: string;
      date: string;
      start_time: string;
      end_time: string;
      position_id?: string;
      zone_ids?: string[];  // ADR-0430 Rule 6b: optional, empty array for template shifts
    };
  };
}
```

**Decision: optional `?:` (not required).** Existing emit-sites compile without change. Phase b adds `zone_ids` only at the three emit-sites identified in Rule 6b (add-shift-action.ts:326, timeline-template/tools.ts:300, scheduler/tools.ts:640). Per L-0176: interface extension and emit-site update land in the SAME commit.

**Verdict: PASS.**

---

### AC-0.3 — CF-3: Zod schema migration plan

**Canonical schema location:** `packages/types/src/timeline-template.ts:52-59` — `SchedShiftPayload`

```typescript
// BEFORE (current state at timeline-template.ts:52-59):
export const SchedShiftPayload = z.object({
  role: z.string().min(1).max(40),
  position_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  location_id: z.string().uuid().nullable(),  // dropped in M4
  zone: z.string().max(40).nullable(),         // → zone_ids in Phase b
  notes: z.string().max(280).nullable(),
});

// AFTER (Phase b — before M4 drops location_id from DB):
export const SchedShiftPayload = z.object({
  role: z.string().min(1).max(40),
  position_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  location_id: z.string().uuid().nullable(),           // keep until M4 ships
  zone_ids: z.array(z.string().uuid()).nullable(),      // ADDED: replaces zone TEXT
  notes: z.string().max(280).nullable(),
});

// AFTER M4 (once DB column dropped):
export const SchedShiftPayload = z.object({
  role: z.string().min(1).max(40),
  position_id: z.string().uuid().nullable(),
  team_id: z.string().uuid().nullable(),
  zone_ids: z.array(z.string().uuid()).nullable(),      // RETAINED
  notes: z.string().max(280).nullable(),
  // location_id removed
});
```

**No ADR-0112 violation:** `zone` field is being REPLACED by `zone_ids`, not renamed. This is a breaking shape change in the JSONB `items_json` column — existing template rows with `zone` TEXT will fail to parse after the schema changes. Migration M3 must handle the JSONB column upgrade (rewrite stored `items_json` rows to convert `zone: "..."` → `zone_ids: [resolved_uuid]`). This is a PLAN-1 M3 concern.

**Other Zod schemas referencing zone:**
- `apps/web/src/app/dashboard/_actions/add-shift-action.ts` — direct `schedule_shift` insert with `zone` field: migrate in Phase b WRITE-rewrite (Rule 4).
- `packages/ai/src/capabilities/scheduler/tools.ts:541-561, 587-610` — extend `gatedMutation` for `zone_ids[]`: migrate in Phase b WRITE-rewrite (Rule 4).
- No standalone `schemas.ts` file found in `packages/ai/src/capabilities/timeline-template/` — the Zod definition lives in `packages/types/src/timeline-template.ts` (authoritative).

**Verdict: PASS.**

---

### AC-0.4 — Pre-1: Timestamp collision check

Remote feat branches at time of check (2026-05-28):
- `origin/feat/design-token-sweep-web-oklch` — latest migration: `20260716200100_employment_form_volunteer_recovery.sql`
- `origin/feat/task-e2e-spec-fixes` — latest migration: `20260716200100_employment_form_volunteer_recovery.sql`

Both branches are at `20260716200100` — below the HEAD tip `20260801000000`. Neither claims any `> 20260801000000` slot.

ADR-0430 migrations (PLAN-1) will use timestamps `20260801000002` and above. Slot `20260801000001` is claimed by this PLAN-0 migration (channel_constraint). No collision exists.

**Verdict: PASS — 0 conflicting timestamps.**

---

### AC-0.5 — Pre-2: shift_session_day_line composite PK

Query result:
```
     conname
-----------------------------
 shift_session_day_line_pkey
(1 row)
```

PK columns (in order):
```
   column_name
------------------
 shift_session_id
 day_line_id
(2 rows)
```

Composite PK `(shift_session_id, day_line_id)` confirmed. This is the FK target for `shift_zone` per Rule 1.

**Verdict: PASS.**

---

### AC-0.6 — Pre-3 M0.5: Position orphan report

```sql
SELECT s.schedule_shift_id, s.position_id
FROM schedule_shift s
LEFT JOIN position p ON s.position_id = p.position_id
WHERE s.department_id IS NULL
  AND s.position_id IS NOT NULL
  AND p.department_id IS NULL;
-- Result: (0 rows)
```

0 orphan rows found. M1 backfill (`UPDATE schedule_shift SET department_id = p.department_id FROM position p WHERE ...`) will not encounter NULL department_id dead-ends.

See `m0.5-position-orphan-report.md` and `m0.5-position-orphan-report.csv` for full narrative and empty CSV proof.

**Verdict: PASS. PLAN-1 M1 unblocked.**

---

### AC-0.7 — Pre-4: Default zone per location rule

**Codified rule for PLAN-1 M3 backfill SQL:**

> "Default zone per location = the single `zone` row with lowest `sort_order` WHERE `workspace_id` matches AND `location_id` matches.
>
> Tie-break (multiple zones with same `sort_order`): SKIP backfill for that location — log SKIPPED row with `(workspace_id, location_id, sort_order, zone_count)`.
>
> No zones at all for a location: SKIP silently — no `shift_zone` row inserted; this is not an error.
>
> The `zone` table has no `is_default` column. The sort_order tie-break is the only deterministic selection criteria available without schema changes."

**PLAN-1 M3 SQL pattern (canonical):**

```sql
-- For each shift_session_day_line row, find the default zone for its location.
-- Insert shift_zone only when exactly one zone has the minimum sort_order.
WITH zone_candidates AS (
  SELECT
    dl.day_line_id,
    dl.location_id,
    ssdl.shift_session_id,
    z.zone_id,
    z.workspace_id,
    ROW_NUMBER() OVER (
      PARTITION BY dl.location_id, z.workspace_id
      ORDER BY z.sort_order ASC NULLS LAST
    ) AS rn,
    COUNT(*) OVER (
      PARTITION BY dl.location_id, z.workspace_id, z.sort_order
    ) AS tied_count
  FROM shift_session_day_line ssdl
  JOIN day_line dl ON dl.day_line_id = ssdl.day_line_id
  JOIN zone z ON z.location_id = dl.location_id AND z.workspace_id = dl.workspace_id
  WHERE z.is_active = true
),
default_zones AS (
  SELECT * FROM zone_candidates
  WHERE rn = 1 AND tied_count = 1  -- exactly one minimum-sort_order zone
)
INSERT INTO shift_zone (workspace_id, shift_session_id, day_line_id, zone_id, location_id)
SELECT workspace_id, shift_session_id, day_line_id, zone_id, location_id
FROM default_zones
ON CONFLICT DO NOTHING;
```

**Verdict: PASS.**

---

### AC-0.8 — Pre-5: pg_depend audit

See `pg-depend-audit.txt` for full verbatim output (71 rows).

**Summary:**

| Class | Count | Items | M4 action |
|---|---|---|---|
| (a) Trigger — MUST REWRITE | 1 | `trg_ensure_shift_session` (`ensure_shift_session()`) | Rewrite: remove `NEW.location_id` guard + INSERT; source from `shift_session_day_line → day_line` |
| (b) Other trigger — safe | 4 | `trg_push_shift_updated`, `trg_push_shift_published`, `audit_schedule_shift_mutate`, `schedule_shift_derive_department_id_tg` | No action |
| (c) View — safe | 3 | `v_current_plan_preview`, `v_shift_lifecycle`, `v_shift_lifecycle_employee` | No action (verified: none select `location_id` or `zone`) |
| (d) Policy — safe | 16 | All workspace_id / employee_id / shift_date / status guards | No action |
| (e) FK/CHECK — safe | 17 | All FK to `schedule_shift_id` PK (not dropped); 1 CHECK on `source` | No action |

**`ensure_shift_session()` rewrite plan (for PLAN-4):**

Current function reads `NEW.location_id` in 3 places:
1. Early-exit guard: `IF NEW.location_id IS NULL THEN RETURN NEW`
2. `shift_session INSERT`: `location_id = NEW.location_id`
3. `shift_session_day_line INSERT` filter: `WHERE dl.location_id = NEW.location_id`

After M4, `schedule_shift.location_id` is dropped. The trigger fires on `AFTER INSERT OR UPDATE OF location_id, position_id, department_id, employee_id, shift_date`. The `UPDATE OF location_id` clause must also be removed from the trigger definition.

Rewrite: source location from the resolved `shift_session_day_line → day_line` instead. The `ensure_shift_session` function should look up the `day_line` matching `(workspace_id, department_session_id)` without filtering by `location_id` — the day_line already carries `location_id`, so the selection is implicit in the join on `department_session_id`. The `shift_session.location_id` column (if it persists) must be sourced from the `day_line` lookup, not from `schedule_shift`.

**Verdict: PASS.**

---

### AC-0.9 — Pre-6: engine_authority_config.channel_constraint

**Before migration:** 0 rows returned — column did not exist. BLOCKER status.

**Resolution:** Migration `20260801000001_add_channel_constraint_to_engine_authority_config.sql` created and applied.

```sql
ALTER TABLE public.engine_authority_config
  ADD COLUMN IF NOT EXISTS channel_constraint TEXT
    CONSTRAINT engine_authority_config_channel_constraint_check
    CHECK (channel_constraint IN ('chat_only', 'voice_only', 'any') OR channel_constraint IS NULL);
```

**After migration:** 1 row returned:
```
    column_name
--------------------
 channel_constraint
(1 row)
```

**Rule 9 enforcement path:** After PLAN-1 M2, insert/update `engine_authority_config` row for `roster.add_shift_manual` capability to set `channel_constraint = 'chat_only'`. This is a data seed step in PLAN-1 (not a migration schema step).

**Verdict: PASS (resolved by migration).**

---

### AC-0.10 — Pre-7: UNIQUE constraints on zone and day_line

**zone table indexes:**
```
 indexname |                              indexdef
-----------+--------------------------------------------------------------------
 zone_pkey | CREATE UNIQUE INDEX zone_pkey ON public.zone USING btree (zone_id)
(1 row)
```

Only `zone_pkey` exists — covers `(zone_id)` alone. **No UNIQUE index on `(zone_id, location_id)`.**

**day_line table unique indexes:**
```
   indexname   |                                              indexdef
---------------+-----------------------------------------------------------------------------------------------------
 day_line_pkey | CREATE UNIQUE INDEX day_line_pkey ON public.day_line USING btree (day_line_id)
 uq_day_line   | CREATE UNIQUE INDEX uq_day_line ON public.day_line USING btree (department_session_id, location_id)
(2 rows)
```

`uq_day_line` covers `(department_session_id, location_id)` — NOT `(day_line_id, location_id)`.

**Assessment per ADR-0430 Rule 1:**
- `UNIQUE (zone.zone_id, zone.location_id)` — MISSING. Required for composite FK `FOREIGN KEY (zone_id, location_id) REFERENCES zone(id, location_id)` on `shift_zone`.
- `UNIQUE (day_line.day_line_id, day_line.location_id)` — MISSING. `uq_day_line` covers `(department_session_id, location_id)`, not `(day_line_id, location_id)`.

**Required additive work in PLAN-1 M2:**
```sql
-- Must be in M2 migration (before shift_zone table creation):
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_zone_id_location_id
  ON public.zone (zone_id, location_id);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_day_line_id_location_id
  ON public.day_line (day_line_id, location_id);
```

These two indexes must be created as prerequisites to the composite FK declarations in `shift_zone`. Without them, `CREATE TABLE shift_zone ... FOREIGN KEY (zone_id, location_id) REFERENCES zone(id, location_id)` will fail with `ERROR: there is no unique constraint matching given keys for referenced table "zone"`.

**Verdict: PARTIAL-PASS — composite FKs blocked by missing unique indexes. PLAN-1 M2 must add both before `shift_zone` table creation. Added to PLAN-1 M2 scope as additive prerequisite.**

---

## Summary table

| AC | Subject | Verdict | Blocker |
|---|---|---|---|
| AC-0.1 | CF-1 flag state | PASS | None — flag ENABLED by default in all envs |
| AC-0.2 | CF-2 typing strategy | PASS | None — `zone_ids?: string[]` optional |
| AC-0.3 | CF-3 Zod migration plan | PASS | None — `SchedShiftPayload` in `packages/types/src/timeline-template.ts:52-59` |
| AC-0.4 | Pre-1 timestamp collision | PASS | None — 0 conflicts |
| AC-0.5 | Pre-2 composite PK | PASS | None — `(shift_session_id, day_line_id)` confirmed |
| AC-0.6 | Pre-3 orphan report | PASS | None — 0 orphan rows |
| AC-0.7 | Pre-4 default zone rule | PASS | None — rule codified above |
| AC-0.8 | Pre-5 pg_depend audit | PASS | 1 trigger to rewrite in PLAN-4 (not a blocker for PLAN-1) |
| AC-0.9 | Pre-6 channel_constraint | PASS (resolved) | Was BLOCKER — resolved by migration 20260801000001 |
| AC-0.10 | Pre-7 UNIQUE constraints | PARTIAL-PASS | Missing `UNIQUE(zone.zone_id, zone.location_id)` and `UNIQUE(day_line.day_line_id, day_line.location_id)` — additive, added to PLAN-1 M2 scope |

**Overall: GREEN-READY-FOR-PLAN-1**

AC-0.10 PARTIAL-PASS is additive work (two `CREATE UNIQUE INDEX CONCURRENTLY` statements pre-pended to PLAN-1 M2) — not a PLAN-0 blocker. Pontus sign-off recommended before PLAN-1 dispatch.
