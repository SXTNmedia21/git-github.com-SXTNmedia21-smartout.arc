-- 20260427200000_notification_outbox_reliability.sql
-- Adds retry support, updated_at, tighter RLS, and atomic row-locking RPC
-- for the notification outbox consumer.

-- 1. Add retry_count and updated_at columns
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS retry_count smallint NOT NULL DEFAULT 0;
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER set_notification_outbox_updated_at
  BEFORE UPDATE ON notification_outbox
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Tighten RLS — replace the overly permissive "System manages outbox" policy.
-- The consumer uses service_role (bypasses RLS). DB triggers use SECURITY DEFINER
-- (bypasses RLS). Only the Next.js API route would hit RLS with a user JWT — and
-- Fix 1 was eliminated, so no user-JWT writes happen. Keep RLS enabled but restrict.
DROP POLICY IF EXISTS "System manages outbox" ON notification_outbox;

-- Service role bypasses RLS entirely, so these policies only gate JWT-authenticated access.
-- No JWT user should read or write the outbox directly.
CREATE POLICY "No direct user access to outbox" ON notification_outbox
  FOR ALL USING (false) WITH CHECK (false);

-- 3. Create atomic row-locking RPC for the consumer
CREATE OR REPLACE FUNCTION fetch_pending_outbox(p_batch_size int DEFAULT 100)
RETURNS SETOF notification_outbox
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset rows stuck in 'processing' for over 5 minutes (staleness recovery)
  UPDATE notification_outbox
  SET status = 'pending', updated_at = now()
  WHERE status = 'processing'
    AND updated_at < now() - interval '5 minutes';

  -- Fetch and lock pending rows + failed rows eligible for retry
  RETURN QUERY
  UPDATE notification_outbox
  SET status = 'processing', updated_at = now()
  WHERE id IN (
    SELECT id FROM notification_outbox
    WHERE (status = 'pending' AND scheduled_for <= now())
       OR (status = 'failed' AND retry_count < 3)
    ORDER BY priority DESC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;
