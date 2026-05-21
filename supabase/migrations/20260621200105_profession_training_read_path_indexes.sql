-- ============================================================
-- RA1: Add read-path indexes to profession_training spine
-- WHY: RA3 reader tool + RA2c bootstrap seed query by
--      (workspace_id, profession_id). The original migration
--      (20260421100300) ships only a UNIQUE constraint on
--      (profession_id, protocol_id, workspace_id) — no index
--      that covers workspace_id-first lookups.
--      Zero behavior change. ADDITIVE only. ADR-0379a / RA1.
-- ============================================================

-- Primary read path: fetch mandatory protocols for a given
-- workspace + profession (RA3 list_mandatory_protocols_for_role).
-- Covers: WHERE workspace_id = $1 AND profession_id = $2
--     AND: WHERE workspace_id IS NULL AND profession_id = $2  (platform rows)
CREATE INDEX IF NOT EXISTS idx_profession_training_workspace_profession
  ON public.profession_training (workspace_id, profession_id);

-- Secondary path: seed idempotency check (RA2c).
-- Covers: WHERE profession_id = $1 AND protocol_id = $2
--         AND workspace_id IS NULL  (platform-level dedup)
-- NOTE: the UNIQUE NULLS NOT DISTINCT constraint already enforces
-- uniqueness but does NOT guarantee fast lookup by (profession_id,
-- protocol_id) alone — Postgres may or may not use the unique index
-- depending on statistics. An explicit covering index makes the plan
-- deterministic for the seed's ON CONFLICT DO NOTHING path.
CREATE INDEX IF NOT EXISTS idx_profession_training_profession_protocol
  ON public.profession_training (profession_id, protocol_id);
