-- Add training content columns to procedure_step
-- Required for HMS Phase 1: Opplaering 5-stage learning flow
-- These columns enable rich learning content per step (video, images, extended explanations)
-- while keeping the compact `description` for operational task view (Drift)

ALTER TABLE procedure_step ADD COLUMN training_content text;
ALTER TABLE procedure_step ADD COLUMN media_urls jsonb;

COMMENT ON COLUMN procedure_step.training_content IS 'Extended learning material shown in training mode. Markdown supported.';
COMMENT ON COLUMN procedure_step.media_urls IS 'Array of {type: "image"|"video", url: string, caption: string} for training media.';
