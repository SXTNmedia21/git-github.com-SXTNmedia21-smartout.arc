-- Link profession to tariff_rate_table
-- Extracted from 20260328200000_add_profession_system.sql because
-- tariff_rate_table is created in 20260421100200_cascade_a1_domain_tables.sql.

ALTER TABLE public.tariff_rate_table
  ADD COLUMN IF NOT EXISTS profession_id UUID REFERENCES public.profession(profession_id) ON DELETE SET NULL;
