-- Allow engine_sessions.expires_at to be NULL for long-lived missions (e.g., season-lifecycle).
-- Sessions with expires_at = NULL never auto-expire; Guardian watches them via calendar rules.
-- Connected to: docs/plans/2026-03-04-season-engine-design.md

ALTER TABLE engine_sessions ALTER COLUMN expires_at DROP NOT NULL;
