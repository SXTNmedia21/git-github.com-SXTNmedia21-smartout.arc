-- ============================================================================
-- schedule_absence.absence_type  TEXT → Postgres ENUM
-- ============================================================================
--
-- Council (2026-04-23 Hospitality) flagged 🟡: `absence_type TEXT NOT NULL`
-- with no CHECK constraint and no enum. Task E of PLAN-shift-swap-harness.
--
-- Canonical value set: mirrors `AbsenceTypeEnum` in
-- `packages/types/src/enums.ts` (7 values). This aligns DB with the
-- authored TS contract. UI (`pending-absence-list.tsx`,
-- `absence-popover.tsx`) already uses these exact 7 values.
--
-- ── Enum name: `schedule_absence_type` (NOT `absence_type`) ──
-- Rationale: `payroll.absence_type` already exists as a TABLE in the
-- payroll schema. While `pg_type` and `pg_class` are separate
-- namespaces, co-locating a TYPE and a TABLE under the same identifier
-- produces confusing `database.types.ts` output and error messages.
-- Scoped name `schedule_absence_type` is unambiguous.
--
-- ── L-0075 0a/0b/0c pattern (single transaction) ──
-- 0a: CREATE TYPE (idempotent DO guard)
-- 0b: Pre-cast data fix + ALTER COLUMN TYPE with USING clause
-- 0c: Enum column itself enforces the constraint — no redundant CHECK
--
-- ── Data preservation ──
-- `seed.sql:2243` inserts `'personal'` (legacy value not in TS enum).
-- We coerce any existing `'personal'` rows to `'unpaid_leave'` before
-- the cast. This is the closest semantic match (free time off, no pay
-- implication specified). This protects prod-like environments that
-- may have inherited the same value through seed runs.
--
-- ── FOLLOW-UP (out of this migration's scope, flagged in handoff) ──
-- `supabase/seed.sql:2243` still emits `'personal'` — seed must be
-- updated in the same merge batch or `supabase db reset` will fail
-- after this migration lands. Not touched here (task E scope: migration
-- only).
-- ============================================================================

-- 0a: create the enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_absence_type') THEN
    CREATE TYPE public.schedule_absence_type AS ENUM (
      'sick_leave',
      'parental_leave',
      'vacation',
      'unpaid_leave',
      'military',
      'training',
      'welfare'
    );
  END IF;
END $$;

-- 0b: coerce any legacy value not in the canonical set BEFORE the cast,
-- then ALTER COLUMN TYPE. Split out defensively so the cast cannot
-- silently succeed on an unexpected value.
UPDATE public.schedule_absence
  SET absence_type = 'unpaid_leave'
  WHERE absence_type = 'personal';

-- Guard: any remaining value outside the canonical set will fail the cast
-- (intentional — surfaces unknown values rather than silently dropping them).

ALTER TABLE public.schedule_absence
  ALTER COLUMN absence_type TYPE public.schedule_absence_type
  USING absence_type::public.schedule_absence_type;

-- 0c: column is NOT NULL (carried from original DDL). No redundant CHECK
-- constraint needed — the enum itself is the domain restriction.

COMMENT ON COLUMN public.schedule_absence.absence_type IS
  'Absence category. Enum public.schedule_absence_type, mirrored in AbsenceTypeEnum (packages/types/src/enums.ts).';
