-- Add JSONB column for Onboarding Guide progress tracking.
-- Stores: { current_step, completed_steps[], started_at, last_activity }
-- NULL = guide never started.
ALTER TABLE workspace ADD COLUMN IF NOT EXISTS onboarding_guide_progress JSONB DEFAULT NULL;
