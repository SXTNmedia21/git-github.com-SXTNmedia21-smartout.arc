-- ============================================================================
-- 20260521000400_billing_seed_accountant_placeholder.sql
--
-- Placeholder grant for Erik (Smartout's regnskapsfører).
-- M4 resolves Erik's actual user_id from production identity at seed-time.
-- This migration is a no-op until the 'erik@<TBD>' email is replaced.
--
-- ⚠️  PLACEHOLDER ONLY — never seed to production with this literal.
--     M4 fill-in: replace 'erik@<TBD>' with the real email address.
--
-- Blueprint §3 seed pattern.
-- ============================================================================

INSERT INTO billing.accountant_company_grant
  (user_id, company_id, scope, granted_by)
SELECT
  ui.user_id,
  c.company_id,
  'full_kartotek'::billing.accountant_grant_scope,
  (SELECT user_id FROM public.user_identity WHERE is_godmode = true LIMIT 1)
FROM public.user_identity ui
CROSS JOIN public.company c
WHERE ui.email = 'erik@<TBD>'   -- placeholder — M4 fills in real email
ON CONFLICT (user_id, company_id) DO NOTHING;
