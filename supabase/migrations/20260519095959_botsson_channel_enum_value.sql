-- =============================================================================
-- 20260519095959_botsson_channel_enum_value.sql
-- C1.d — comm_channel_type ADD VALUE 'ai' (split from 20260519100000)
-- 
-- Postgres forbids using a newly-added enum value in the same transaction
-- as the ALTER TYPE. This split lets the value commit before the bootstrap
-- migration uses it.
-- =============================================================================

ALTER TYPE public.comm_channel_type ADD VALUE IF NOT EXISTS 'ai';
