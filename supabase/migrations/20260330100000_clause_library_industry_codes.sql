-- Add industry_codes column to clause_library for branch-specific clause filtering.
-- NACE codes let the contract builder show only relevant clauses per industry.
-- Universal clauses (legal, GDPR, general SaaS terms) have an empty array
-- and are always included regardless of the customer's industry.

-- ─── 1. Add column ─────────────────────────────────────────────
ALTER TABLE public.clause_library
  ADD COLUMN IF NOT EXISTS industry_codes text[] DEFAULT '{}';

COMMENT ON COLUMN public.clause_library.industry_codes IS
  'NACE rev. 2 codes for industry-specific filtering. Empty array = universal (shown to all industries).';

-- ─── 2. GIN index for array overlap queries (@> and &&) ────────
CREATE INDEX IF NOT EXISTS idx_clause_library_industry_codes
  ON public.clause_library USING GIN (industry_codes);

-- ─── 3. Seed NACE codes on existing clauses ────────────────────
-- All 24 existing clauses (12 NO + 12 EN) are generic SaaS/B2B
-- contract terms (Parties, Service, Payment, Duration, GDPR,
-- Confidentiality, Liability, IP, Force Majeure, Amendments,
-- Disputes, Signatures). None are industry-specific.
--
-- They keep the default empty array '{}' which means "universal —
-- always shown regardless of customer industry."
--
-- Future industry-specific clauses will be inserted with codes:
--   Restaurant/food service (HACCP, matallergier, alkoholservering):
--     56.10 (Restaurants), 56.21 (Event catering), 56.30 (Bars)
--   Hotel/accommodation (romsstädning, nattevakt, brannsikkerhet):
--     55.10 (Hotels), 55.20 (Holiday/short-stay accommodation)
--   Retail (varemottak, kassarutiner):
--     47.11 (Non-specialised retail, food), 47.19 (Other non-specialised retail)
--
-- No UPDATE needed — default value '{}' already applied by ADD COLUMN.
