-- ============================================
-- 20260515150000_channel_message_pii_columns.sql
-- Progressive Channel Phase 1A — PII classifier audit columns (ADR-0166)
-- ============================================
-- ADR-0166 formalizes the soft-hold PII classifier for public-mode
-- helpdesk channels. The classifier runs on channel_message insert
-- with an 800ms timeout; when PII is detected, the original content
-- is copied to an audit trail + private sub-channel while the public
-- timeline sees a redaction placeholder.
--
-- This migration ships the DATA columns the classifier writes. It
-- does NOT ship the on-insert hook (trigger or Edge Function) — that
-- lands with Phase 1A.2 application code once the Server Action
-- `spawnPrivateSubChannel` path is implemented.
--
-- All three columns are NULLABLE with no default. A NULL value means:
--   - classification_metadata = NULL → message not yet classified
--     (pre-1A.2 legacy, or classifier disabled for this channel).
--   - redacted_at = NULL           → original content still visible.
--   - original_content_hash = NULL → no classifier run recorded.
--
-- Additive-only. No existing rows mutated, no constraints tightened.
-- Safe to deploy independently of the application hook.
-- ============================================

SET search_path TO public, extensions;

-- ── 1. Classifier output metadata (jsonb) ───────────────────────────
-- Shape written by Phase 1A.2 hook:
--   {
--     "detected": boolean,
--     "categories": ["personnummer", "phone_nor", ...],
--     "classifier_version": "1.0.0-regex-nor",
--     "classifier_duration_ms": number,
--     "soft_hold_outcome": "redacted" | "allowed" | "timeout"
--   }
-- NEVER stores raw matched text. The matches array from the classifier
-- is reduced to categories + outcome before writing here.

ALTER TABLE public.channel_message
  ADD COLUMN IF NOT EXISTS classification_metadata jsonb;

COMMENT ON COLUMN public.channel_message.classification_metadata IS
  'ADR-0166: PII classifier output. Shape: { detected, categories[], classifier_version, classifier_duration_ms, soft_hold_outcome }. NULL = not yet classified. Never stores raw matched text.';

-- ── 2. Redaction timestamp ──────────────────────────────────────────
-- Set by the hook when content was replaced by a redaction placeholder.
-- The redacted placeholder itself is written into the existing `content`
-- column; this timestamp marks the swap. NULL means "original visible".

ALTER TABLE public.channel_message
  ADD COLUMN IF NOT EXISTS redacted_at timestamptz;

COMMENT ON COLUMN public.channel_message.redacted_at IS
  'ADR-0166: timestamp when message content was replaced by redaction placeholder. NULL = not redacted (original visible).';

-- ── 3. SHA-256 hex of original content ──────────────────────────────
-- Written at classification time, regardless of redaction outcome.
-- Used for audit trails (admin PII-detection log viewer) and future
-- de-duplication of identical-content detections. NEVER stores
-- plaintext. Hash is produced by the classifier itself (see
-- packages/ai/src/classifiers/pii-classifier.ts).

ALTER TABLE public.channel_message
  ADD COLUMN IF NOT EXISTS original_content_hash text;

COMMENT ON COLUMN public.channel_message.original_content_hash IS
  'ADR-0166: SHA-256 hex of original content at classification time. Used for audit + de-dupe. Never stores plaintext.';

-- ── 4. Partial index for admin audit queries ────────────────────────
-- The admin PII-detection log viewer (Phase 1A.2 UI) filters messages
-- by workspace + redaction state. Partial index on redacted rows keeps
-- the index small (only rows that triggered the soft-hold) while
-- supporting the dominant query path.

CREATE INDEX IF NOT EXISTS idx_channel_message_redacted
  ON public.channel_message(redacted_at, workspace_id)
  WHERE redacted_at IS NOT NULL;

COMMENT ON INDEX public.idx_channel_message_redacted IS
  'ADR-0166: supports admin PII-detection log viewer query path (filter by workspace + redaction state).';
