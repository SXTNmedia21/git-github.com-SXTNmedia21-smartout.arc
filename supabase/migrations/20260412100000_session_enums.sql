SET search_path TO public, extensions;

-- ============================================
-- 20260412100000_session_enums.sql
-- Creates enums for session hooks, tasks, and notes.
-- Source: Module Zero to Production — Week 2
-- ============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_hook_type') THEN
    CREATE TYPE session_hook_type AS ENUM (
      'pre_open',
      'open',
      'scheduled',
      'pre_close',
      'close'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_task_status') THEN
    CREATE TYPE session_task_status AS ENUM (
      'pending',
      'available',
      'in_progress',
      'completed',
      'skipped',
      'overdue',
      'escalated'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'session_note_type') THEN
    CREATE TYPE session_note_type AS ENUM (
      'handoff',
      'closing',
      'general'
    );
  END IF;
END $$;
