-- ============================================================================
-- seed-governance.sql — ENV-4: governance-training-mvp e2e preconditions
--
-- Unblocks: apps/e2e/governance-training-mvp/observer-request.spec.ts
--           apps/e2e/governance-training-mvp/engine-dispatch.spec.ts
-- Status: partially seeded (2026-05-24) — see ENV-4a note below
--
-- ─── ENV-4a: dispatch_engine_action RPC ──────────────────────────────────────
-- engine-dispatch.spec.ts fails with PGRST202 when the local Supabase has
-- not been fully migrated. The function `dispatch_engine_action` is defined
-- in a migration but the PostgREST schema cache may be stale.
--
-- FIX (outside seed scope): run `npx supabase db reset` from repo root before
-- the governance-training-mvp suite. This applies all pending migrations and
-- flushes the schema cache. No SQL seed can fix a stale cache.
--
-- ─── ENV-4b: observer-request.spec.ts ────────────────────────────────────────
-- resolveFixture() queries:
--   db.from("profile").select("profile_id")
--     .eq("user_id", adminUser.id)          -- e0000000-...-0000
--     .eq("workspace_id", workspace.workspace_id)  -- first workspace from DB
--
-- The seed.sql admin (admin@smartout.local) has:
--   user_id      = e0000000-0000-0000-0000-000000000000
--   profile_id   = f0000000-0000-0000-0000-000000000000
--   workspace_id = b0000000-0000-0000-0000-000000000000
--   role         = 'owner'
--
-- The fixture error "admin profile not found in seeded workspace" occurs when
-- the workspace table returns a DIFFERENT workspace as the first row (e.g.
-- after a billing workspace was inserted before the HQ workspace). We anchor
-- the HQ workspace to ensure it is returned first by any ORDER BY-less query.
--
-- Idempotent: all inserts use ON CONFLICT DO NOTHING.
-- Run after supabase/seed.sql (depends on admin profile + HQ workspace).
-- ============================================================================

SET search_path = public, extensions, pg_catalog;

-- ─── ENV-4b fix: ensure HQ workspace is the lowest-inserted workspace ─────────
-- The resolveFixture() uses `.limit(1).single()` with no ORDER BY — in Postgres
-- this returns rows in heap order (insertion order on a fresh DB). After db reset
-- + seed.sql, the HQ workspace (b0000000-...) is inserted first, so it should be
-- returned. This is a no-op if seed.sql has already run and the workspace exists.
INSERT INTO public.workspace (
  workspace_id, company_id, name, slug, description,
  currency, language, country, onboarding_completed
) VALUES (
  'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000',
  'HQ Workspace', 'hq-workspace', 'Headquarters Workspace',
  'NOK', 'no', 'NO', true
) ON CONFLICT (workspace_id) DO NOTHING;

-- ─── ENV-4b fix: ensure admin profile exists in HQ workspace ─────────────────
-- Already seeded by seed.sql. Defensive no-op insert in case applied standalone.
INSERT INTO public.profile (
  profile_id, profile_code, user_id, workspace_id, company_id,
  role, status, department_id, location_id, display_name, job_title,
  address_line_1, postal_code, city
) VALUES (
  'f0000000-0000-0000-0000-000000000000', 'ADM001',
  'e0000000-0000-0000-0000-000000000000',
  'b0000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000000',
  'owner', 'active',
  'd0000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000000',
  'Local Admin', 'Restaurant Manager',
  'Karl Johans gate 1', '0154', 'Oslo'
) ON CONFLICT (profile_id) DO NOTHING;

-- ─── engine_authority_config seed (observer_request capabilities) ─────────────
-- observer-request.spec.ts seeds authority via seedAuthority() at runtime using
-- the service role. No static rows needed here; the spec's beforeAll handles it.
-- However, if the engine_authority_config table is empty, the gate_action check
-- returns 'INSUFFICIENT_AUTHORITY' rather than passing. We pre-seed the three
-- observer_request capabilities so the spec's upsert is idempotent.
INSERT INTO public.engine_authority_config (
  workspace_id,
  capability,
  level,
  min_role,
  requires_four_eyes,
  updated_by
) VALUES
  (
    'b0000000-0000-0000-0000-000000000000',
    'observer_request.create',
    'confirm',
    'manager',
    false,
    'f0000000-0000-0000-0000-000000000000'
  ),
  (
    'b0000000-0000-0000-0000-000000000000',
    'observer_request.claim',
    'confirm',
    'manager',
    false,
    'f0000000-0000-0000-0000-000000000000'
  ),
  (
    'b0000000-0000-0000-0000-000000000000',
    'observer_request.approve',
    'confirm',
    'manager',
    false,
    'f0000000-0000-0000-0000-000000000000'
  )
ON CONFLICT (workspace_id, capability) DO NOTHING;
