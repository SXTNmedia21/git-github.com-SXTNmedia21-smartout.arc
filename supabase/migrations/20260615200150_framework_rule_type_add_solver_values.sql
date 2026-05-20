-- Migration: extend framework_rule_type enum with solver-specific values used by
-- packages/ai/src/scheduler/eligibility.ts and seeded in 20260615200200.
--
-- The original enum (20260421200000_cascade_a2_enums.sql) only contained
-- 'gate', 'constraint', 'advisory', 'commercial'. The riksavtalen seed migration
-- assumed rule_type accepted scheduler-specific values; without these the seed
-- fails with SQLSTATE 22P02 "invalid input value for enum framework_rule_type".
--
-- ADD VALUE IF NOT EXISTS is idempotent. Each ALTER runs in its own implicit
-- transaction since they are top-level statements in a migration.

ALTER TYPE public.framework_rule_type ADD VALUE IF NOT EXISTS 'aml_daily_max_hours';
ALTER TYPE public.framework_rule_type ADD VALUE IF NOT EXISTS 'aml_weekly_max_hours';
ALTER TYPE public.framework_rule_type ADD VALUE IF NOT EXISTS 'aml_weekly_min_hours_floor';
ALTER TYPE public.framework_rule_type ADD VALUE IF NOT EXISTS 'tariff_min_rest_hours';
