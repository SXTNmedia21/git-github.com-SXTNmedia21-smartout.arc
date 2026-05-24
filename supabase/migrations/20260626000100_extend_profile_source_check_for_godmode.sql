-- Migration: extend profile_source_check to allow 'godmode'
-- Created: 2026-05-25
-- ADR: ADR-0410 — Godmode Workspace Auto-Join
--
-- fn_godmode_join_workspace (migration 20260626000000) inserts profile rows
-- with source='godmode'. Pre-existing constraint profile_source_check (added
-- by 20260515100600_source_discriminator_12_tables.sql) locked source to
-- ('operational','bubble_migration','v3_engine') — the godmode insert always
-- failed on a fresh DB. Found by /verify smoke after cherry-pick into
-- development. Adding 'godmode' to the allowed set unblocks ADR-0410 audit
-- semantics ("source proves how the profile was created").
--
-- Idempotent: drop-then-add covers both fresh installs and prod where the
-- constraint may already exist in either shape.

ALTER TABLE public.profile DROP CONSTRAINT IF EXISTS profile_source_check;

ALTER TABLE public.profile
  ADD CONSTRAINT profile_source_check
  CHECK (source IN ('operational', 'bubble_migration', 'v3_engine', 'godmode'));

COMMENT ON CONSTRAINT profile_source_check ON public.profile IS
  'Allowed profile.source values. godmode added 2026-05-25 for ADR-0410 '
  'fn_godmode_join_workspace (was operational/bubble_migration/v3_engine only).';
