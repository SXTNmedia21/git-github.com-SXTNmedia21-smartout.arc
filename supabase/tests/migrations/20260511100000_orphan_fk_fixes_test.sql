-- Migration 20260511100000_orphan_fk_fixes_and_polymorphic_comments test
-- Run with: psql "postgresql://postgres:postgres@localhost:54322/postgres" -f supabase/tests/migrations/20260511100000_orphan_fk_fixes_test.sql
--
-- Covers:
--   1. FK tariff_rate_table.seeded_from_framework_binding_id → workspace_framework_binding(id) exists.
--   2. FK targets the correct column.
--   3. protocol_assignment.assigned_ref_id has a COMMENT citing ADR-0124.
--   4. chat_conversation.source_id has a COMMENT citing ADR-0124.
--
-- Pattern follows supabase/tests/gate-action.sql — plain SQL + DO $$ RAISE EXCEPTION $$
-- (repo does not install pgTAP extension; CI uses psql -f with ON_ERROR_STOP=1).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. FK existence on tariff_rate_table.seeded_from_framework_binding_id
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'tariff_rate_table'
    AND c.contype = 'f'
    AND c.conname = 'tariff_rate_table_seeded_from_framework_binding_id_fkey';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'FAIL: FK tariff_rate_table_seeded_from_framework_binding_id_fkey does not exist';
  END IF;
  RAISE NOTICE 'PASS: FK tariff_rate_table_seeded_from_framework_binding_id_fkey exists';
END
$$;

-- ---------------------------------------------------------------------------
-- 2. FK targets workspace_framework_binding(id)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_target text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_target
  FROM pg_constraint c
  WHERE c.conname = 'tariff_rate_table_seeded_from_framework_binding_id_fkey';

  IF v_target IS NULL OR v_target NOT LIKE '%REFERENCES workspace_framework_binding(id)%' THEN
    RAISE EXCEPTION 'FAIL: FK target wrong — got: %', v_target;
  END IF;
  RAISE NOTICE 'PASS: FK targets workspace_framework_binding(id)';
END
$$;

-- ---------------------------------------------------------------------------
-- 3. COMMENT ON protocol_assignment.assigned_ref_id cites ADR-0124
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_comment text;
BEGIN
  SELECT col_description(
    'public.protocol_assignment'::regclass,
    (SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.protocol_assignment'::regclass
        AND attname = 'assigned_ref_id')
  ) INTO v_comment;

  IF v_comment IS NULL OR v_comment NOT LIKE '%ADR-0124%' THEN
    RAISE EXCEPTION 'FAIL: protocol_assignment.assigned_ref_id COMMENT missing ADR-0124 ref — got: %', v_comment;
  END IF;
  RAISE NOTICE 'PASS: protocol_assignment.assigned_ref_id has ADR-0124 COMMENT';
END
$$;

-- ---------------------------------------------------------------------------
-- 4. COMMENT ON chat_conversation.source_id cites ADR-0124
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_comment text;
BEGIN
  SELECT col_description(
    'public.chat_conversation'::regclass,
    (SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.chat_conversation'::regclass
        AND attname = 'source_id')
  ) INTO v_comment;

  IF v_comment IS NULL OR v_comment NOT LIKE '%ADR-0124%' THEN
    RAISE EXCEPTION 'FAIL: chat_conversation.source_id COMMENT missing ADR-0124 ref — got: %', v_comment;
  END IF;
  RAISE NOTICE 'PASS: chat_conversation.source_id has ADR-0124 COMMENT';
END
$$;

ROLLBACK;
