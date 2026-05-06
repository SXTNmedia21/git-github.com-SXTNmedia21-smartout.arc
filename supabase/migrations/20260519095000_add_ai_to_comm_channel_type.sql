-- Split out from 20260519100000_profile_botsson_channel_bootstrap.sql.
-- Postgres rejects ALTER TYPE ADD VALUE + reference-in-DDL in same transaction.
-- This migration commits the new value before the bootstrap migration uses it.
ALTER TYPE public.comm_channel_type ADD VALUE IF NOT EXISTS 'ai';
