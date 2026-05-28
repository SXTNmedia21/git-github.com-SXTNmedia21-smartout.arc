---
title: "Journey — ADR-0430 Shift Zone M:N Reform"
status: done
updated: 2026-05-29
created: 2026-05-29
feature: adr-0430-shift-zone-m2m
tags: [scheduling, zone, shift, mobile, agent, migration]
---

# Journey — ADR-0430 Shift Zone M:N Reform

Four journeys covering the complete zone assignment reform: web assignment authoring,
mobile read-only display, agent-driven creation, and operator database migration.

---

## Journey 1: Manager Assigns Zone to Shift (Web)

**Role:** Admin/Manager (web dashboard)
**Precondition:**
- Workspace is bootstrapped with locations, departments, and zones.
- At least one `shift_session` exists for the shift (either auto-created by `ensure_shift_session` trigger or via `session-open` capability).
- The manager is on the schedule dashboard (`/dashboard/schedule`).

1. Manager opens ShiftModal by clicking an existing shift in the day grid.
   → System loads shift data; `zones[]` array is populated from `shift_session → shift_session_day_line → shift_zone → zone` embed.
   → User sees shift detail with current zones displayed (empty if none assigned).

2. Manager selects a zone from the zone picker dropdown in the modal.
   → System calls `roster.add_shift_manual` capability tool with `zone_ids[]`.
   → Capability validates `channel_constraint = 'chat_only'` (Rule 9); web authoring bypasses via system channel.
   → `shift_zone` INSERT: `(shift_session_id, day_line_id, zone_id, location_id)` row created.
   → System emits `roster.shift_zone_assigned` telemetry event.
   → User sees confirmation toast; zone pill appears in shift card.

3. Manager saves the shift.
   → System invalidates `["shifts", ...]` TanStack Query cache.
   → Grid re-renders with updated zone pill(s) in the shift card.

**Postcondition:**
- `shift_zone` row exists for `(shift_session_id, day_line_id, zone_id)`.
- Schedule grid shows zone pill via `zones?.[0]?.name`.
- Telemetry event recorded.

**Error paths:**
- Zone not in department's active areas → `roster.add_shift_manual` returns 422 with `zone_not_in_area` code.
- `shift_session` not yet created → trigger `ensure_shift_session` fires on shift INSERT; if department_session missing, no session created → zone assignment deferred until session opens.
- Duplicate zone assignment → `uq_shift_zone_per_dayline` constraint raises 23505; UI shows "Sone allerede tildelt".

---

## Journey 2: Employee Views Zone on Mobile (Read-Only)

**Role:** Employee (mobile app)
**Precondition:**
- Employee has a published shift for today or upcoming dates.
- `shift_zone` rows exist for the shift's session (may be 0 if not yet assigned).
- Employee is authenticated and has a valid JWT.

1. Employee opens the mobile app (home screen or shifts tab).
   → `useMyShifts()` fetches `schedule_shift` rows via `select("*")` (simple query, no zone embed).
   → `useShiftPhase()` determines phase: `before_shift`, `clocked_in`, etc.

2. System renders the appropriate phase view:
   - **BeforeShiftView:** Shows shift time caption without zone (ADR-0430 M4: `.zone` field dropped).
   - **DuringShiftView:** Shows greeting caption without zone.
   - **AfterShiftView:** Shows "Neste vakt" with role only.
   - **ShiftCard:** Renders role and time; zone pill not shown (M4 dropped).

3. Employee navigates to the shift detail (DetailSheet or day view).
   → `useShiftSession(profileId, date)` fetches `shift_session` with `shift_session_day_line → day_line → location` embed.
   → `CalendarItem.zone` field is NOT populated (operations feed dropped zone display per M4).
   → User sees shift detail without zone label in this phase. Full zone display via shift_session query is available for a future enhancement.

**Postcondition:**
- Employee sees shift info; zone not displayed in this release (M4 removed scalar zone column).
- No TS errors; all mobile components compile cleanly against new types.

**Error paths:**
- `shift_session` missing → `useShiftSession` returns `null`; UI shows no session state correctly.
- Network error → TanStack Query surfaces to nearest error boundary; employee sees retry prompt.

---

## Journey 3: Agent Creates Shift With Zones via Chat

**Role:** Manager (via Botsson chat surface)
**Precondition:**
- Workspace has active `engine_authority_config` row for `roster.add_shift_manual` with `channel_constraint = 'chat_only'`.
- Manager is in a chat session on the web dashboard or mobile chat (channel = `chat`).
- Department and zone entities exist.

1. Manager types: "Legg til vakt kjøkken mandag 08-16 med sone Bar 1 og Bar 2"
   → Intent classifier routes to `roster` namespace → `add_shift_manual` capability.
   → Capability validates: `channel = 'chat'` (Rule 9 guard: Zod enum `z.enum(["chat", "system"])` rejects voice surface at line 103-104 of `add-shift-action.ts`).
   → System resolves department_id, employee_id, zone_ids from the request.

2. Agent calls `schedule.create_shift_with_zones` tool:
   - Creates `schedule_shift` row (no `location_id` or `zone` columns per M4).
   - `ensure_shift_session` trigger fires: resolves `location_id` from `day_line`, creates `shift_session` + `shift_session_day_line` rows.
   - Inserts `shift_zone` rows for each zone_id in `zone_ids[]`.
   - Emits `roster.shift_zone_assigned` telemetry (L-0176 pattern: emit AFTER write, not before).

3. Agent confirms: "Vakt lagt til: Kjøkken mandag 08-16, soner: Bar 1, Bar 2."
   → Manager sees confirmation in chat.
   → Schedule grid re-fetches and shows shift with zone pills.

**Postcondition:**
- `schedule_shift` exists without `location_id`/`zone` columns.
- `shift_zone` rows exist for each zone_id.
- Telemetry emitted with `zone_ids[]` in metadata (audit reconstruction per ADR-0309).

**Error paths:**
- Voice surface attempt → `channel: z.enum(["chat", "system"])` Zod guard rejects at tool boundary; BFF returns 422. ADR-0078 channel pinning prevents voice surface reaching this tool.
- Zone not in department's location areas → DB constraint `fk_shift_zone_zone` + `fk_shift_zone_day_line_location` enforce composite FK coherence; INSERT fails with FK violation → agent returns "Sone ikke tilgjengelig i dette området".
- `engine_authority_config` missing `confirm` level → `gateAction()` returns `denied`; agent escalates to approval workflow.

---

## Journey 4: Operator Runs M4 Migration (Database Column Drop)

**Role:** Platform operator / DevOps
**Precondition:**
- All prior migrations (M1, M2, M3) applied and verified green.
- PLAN-4a typecheck is GREEN (0 remaining `schedule_shift.zone` or `schedule_shift.location_id` reads in application code).
- `ensure_shift_session` trigger rewrite (migration `20260801000005`) applied — trigger no longer watches `OF location_id`.
- Supabase local instance running (`npx supabase status` shows running).

1. Operator runs pending migrations:
   ```
   npx supabase migration up --local
   ```
   → Applies `20260801000005_ensure_shift_session_trigger_rewrite.sql`:
      - DROP TRIGGER trg_ensure_shift_session ON schedule_shift.
      - CREATE OR REPLACE FUNCTION ensure_shift_session() — resolves location_id from day_line.
      - CREATE TRIGGER trg_ensure_shift_session (no OF location_id clause).
   → Applies `20260801000006_m4_drop_legacy_location_zone_columns.sql`:
      - DO block verifies `pg_depend` has no remaining references (fails loudly if any exist).
      - ALTER TABLE profile DROP CONSTRAINT IF EXISTS fk_profile_location.
      - ALTER TABLE profile DROP COLUMN IF EXISTS location_id.
      - ALTER TABLE schedule_shift DROP COLUMN IF EXISTS location_id.
      - ALTER TABLE schedule_shift DROP COLUMN IF EXISTS zone.
   → System: "Local database is up to date."

2. Operator regenerates types:
   ```
   npx supabase gen types --local 2>/dev/null > packages/supabase/src/database.types.ts
   ```
   → Verifies: `grep -E "schedule_shift.*location_id|schedule_shift.*zone[^_]|profile.*location_id" packages/supabase/src/database.types.ts` → 0 hits.
   → Verifies: `shift_zone` table present in types.

3. Operator runs typecheck:
   ```
   TURBO_CONCURRENCY=1 pnpm turbo typecheck
   ```
   → All packages GREEN (0 TS errors).

**Postcondition:**
- `\d public.schedule_shift` shows no `location_id` or `zone` column.
- `\d public.profile` shows no `location_id` column.
- `packages/supabase/src/database.types.ts` reflects dropped columns.
- Typecheck passes with 0 errors.
- `shift_zone` M:N table is the authoritative zone membership source.

**Error paths:**
- M4 `pg_depend` check fails → `RAISE EXCEPTION 'M4 BLOCKED: pg_depend rows still reference...'` — operator must resolve remaining dependency before proceeding. Check trigger/view/policy for the column reference.
- `OOM during typecheck` → Use `TURBO_CONCURRENCY=1` and ensure ≥ 6.5 Gi available RAM (`free -h` gate).
- Types already up to date (typegen produces same output) → no-op; commit has no diff.
