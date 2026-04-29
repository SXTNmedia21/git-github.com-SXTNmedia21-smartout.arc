-- M2.3 — workspace_doc_chunk schema integrity
-- T14: polymorphic FK check on (source_type, source_id) via trigger
-- T15: ON DELETE cascade on handbook_chapter / policy / protocol → workspace_doc_chunk
-- T16: unique constraint check on (workspace_id, source_type, source_id, chunk_index)
--
-- Spec: docs/superpowers/specs/2026-04-28-doc-chunk-auto-update.md
-- Plan: docs/plans/PLAN-m2-doc-chunk-auto-update.md (Option C)

-- ─────────────────────────────────────────────────────────────────
-- T14: polymorphic FK check (INSERT/UPDATE)
-- ─────────────────────────────────────────────────────────────────
-- workspace_doc_chunk.source_id has no DB-enforced FK because it points to
-- one of three tables based on source_type. Add a trigger function that
-- verifies the row exists when source_type is in (handbook_chapter, policy,
-- protocol). Other source_type values (procedure, routine, runbook, other)
-- bypass the check — those tables are not yet in scope for governance ingest.

CREATE OR REPLACE FUNCTION check_workspace_doc_chunk_source_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for governance source types in M2.3 scope
  IF NEW.source_type = 'handbook_chapter' THEN
    IF NEW.source_id IS NULL THEN
      RAISE EXCEPTION 'workspace_doc_chunk: source_id required for source_type=handbook_chapter';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM handbook_chapter
      WHERE handbook_chapter_id = NEW.source_id::uuid
        AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'workspace_doc_chunk: handbook_chapter % not found in workspace %',
        NEW.source_id, NEW.workspace_id;
    END IF;
  ELSIF NEW.source_type = 'policy' THEN
    IF NEW.source_id IS NULL THEN
      RAISE EXCEPTION 'workspace_doc_chunk: source_id required for source_type=policy';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM policy
      WHERE policy_id = NEW.source_id::uuid
        AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'workspace_doc_chunk: policy % not found in workspace %',
        NEW.source_id, NEW.workspace_id;
    END IF;
  ELSIF NEW.source_type = 'protocol' THEN
    IF NEW.source_id IS NULL THEN
      RAISE EXCEPTION 'workspace_doc_chunk: source_id required for source_type=protocol';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM protocol
      WHERE protocol_id = NEW.source_id::uuid
        AND workspace_id = NEW.workspace_id
    ) THEN
      RAISE EXCEPTION 'workspace_doc_chunk: protocol % not found in workspace %',
        NEW.source_id, NEW.workspace_id;
    END IF;
  END IF;
  -- Other source_type values: skip check (out of M2.3 scope)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_doc_chunk_source_exists_check ON workspace_doc_chunk;
CREATE TRIGGER workspace_doc_chunk_source_exists_check
  BEFORE INSERT OR UPDATE OF source_id, source_type, workspace_id
  ON workspace_doc_chunk
  FOR EACH ROW EXECUTE FUNCTION check_workspace_doc_chunk_source_exists();

-- ─────────────────────────────────────────────────────────────────
-- T15: ON DELETE cascade triggers (source row deletion → chunks deletion)
-- ─────────────────────────────────────────────────────────────────
-- Reliable DB-level cleanup so orphan chunks cannot accumulate. Belt-and-
-- suspenders alongside governance.content_updated trigger='delete' emit
-- path: emit drives Botsson/PostHog signal, trigger guarantees DB integrity.

CREATE OR REPLACE FUNCTION cascade_delete_workspace_doc_chunks()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'handbook_chapter' THEN
    DELETE FROM workspace_doc_chunk
    WHERE workspace_id = OLD.workspace_id
      AND source_type = 'handbook_chapter'
      AND source_id::uuid = OLD.handbook_chapter_id;
  ELSIF TG_TABLE_NAME = 'policy' THEN
    DELETE FROM workspace_doc_chunk
    WHERE workspace_id = OLD.workspace_id
      AND source_type = 'policy'
      AND source_id::uuid = OLD.policy_id;
  ELSIF TG_TABLE_NAME = 'protocol' THEN
    DELETE FROM workspace_doc_chunk
    WHERE workspace_id = OLD.workspace_id
      AND source_type = 'protocol'
      AND source_id::uuid = OLD.protocol_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS handbook_chapter_cascade_chunks ON handbook_chapter;
CREATE TRIGGER handbook_chapter_cascade_chunks
  BEFORE DELETE ON handbook_chapter
  FOR EACH ROW EXECUTE FUNCTION cascade_delete_workspace_doc_chunks();

DROP TRIGGER IF EXISTS policy_cascade_chunks ON policy;
CREATE TRIGGER policy_cascade_chunks
  BEFORE DELETE ON policy
  FOR EACH ROW EXECUTE FUNCTION cascade_delete_workspace_doc_chunks();

DROP TRIGGER IF EXISTS protocol_cascade_chunks ON protocol;
CREATE TRIGGER protocol_cascade_chunks
  BEFORE DELETE ON protocol
  FOR EACH ROW EXECUTE FUNCTION cascade_delete_workspace_doc_chunks();

-- ─────────────────────────────────────────────────────────────────
-- T16: unique constraint verification + add if missing
-- ─────────────────────────────────────────────────────────────────
-- Existing migrations declare uniqueness on (workspace_id, source_path,
-- chunk_index). T11 transactional ingest pattern relies on
-- (workspace_id, source_type, source_id, chunk_index) for upsert-by-source.
-- Add an additional unique index when missing — harmless duplicate of
-- existing logic if the index already covers the same tuple.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'workspace_doc_chunk'
      AND indexname = 'workspace_doc_chunk_source_chunk_idx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX workspace_doc_chunk_source_chunk_idx
      ON workspace_doc_chunk (workspace_id, source_type, source_id, chunk_index)
      WHERE source_id IS NOT NULL';
  END IF;
END $$;
