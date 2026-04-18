-- ============================================
-- 20260512000009_dunning_status_fase3a_values.sql
-- Billing Engine Fase 3A — B4 gap-fill
--
-- Context:
--   B1 seeded the dunning_escalation_scan engine_process (Migration G)
--   with action_payload stages referencing 'reminder_1', 'reminder_2',
--   and 'collection_notice'. The spec (§4.2) + ADR-0134 require the
--   handler to UPDATE invoice.dunning_status to those same values. But
--   dunning_status enum (Fase 1 Migration 20260417121600) only carries
--   {none, in_negotiation, reminder_sent, escalated}. B1 missed the
--   enum extension — this migration closes the gap BEFORE B4 handler
--   code lands.
--
-- Additive-only: existing {none, in_negotiation, reminder_sent, escalated}
-- values stay for backward compatibility. Legacy UI may still display
-- them; the handler writes only the new values.
--
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres — this
-- migration contains only ADD VALUE statements so `supabase db reset`
-- runs it cleanly against a fresh enum type. IF NOT EXISTS makes re-runs
-- a no-op.
--
-- Ref: Fase 3A spec §4.2, ADR-0134, B1 Migration E (dunning_escalation_log).
-- ============================================

ALTER TYPE public.dunning_status ADD VALUE IF NOT EXISTS 'reminder_1';
ALTER TYPE public.dunning_status ADD VALUE IF NOT EXISTS 'reminder_2';
ALTER TYPE public.dunning_status ADD VALUE IF NOT EXISTS 'collection_notice';

COMMENT ON TYPE public.dunning_status IS
  'Dunning progression. Legacy values {none, in_negotiation, reminder_sent, escalated} kept for backward compatibility. Fase 3A adds {reminder_1, reminder_2, collection_notice} matching dunning_escalation_scan stages (ADR-0134, spec §4.2). NULL for terminal invoice states (draft/paid/void/uncollectible).';
