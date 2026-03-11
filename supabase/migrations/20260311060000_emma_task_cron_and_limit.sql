-- emma_task: max 3 active tasks per profile + pg_cron trigger every 10 min.

-- 1. Max 3 active tasks (pending or triggered) per profile
CREATE OR REPLACE FUNCTION check_emma_task_limit()
RETURNS TRIGGER AS $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM emma_task
  WHERE profile_id = NEW.profile_id
    AND status IN ('pending', 'triggered');

  IF active_count >= 3 THEN
    RAISE EXCEPTION 'Max 3 active tasks per profile. Complete or dismiss existing tasks first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_emma_task_limit
  BEFORE INSERT ON emma_task
  FOR EACH ROW EXECUTE FUNCTION check_emma_task_limit();

-- 2. Function that marks due tasks as triggered (runs in DB, no HTTP needed)
CREATE OR REPLACE FUNCTION trigger_due_emma_tasks()
RETURNS INTEGER AS $$
DECLARE
  triggered_count INTEGER;
BEGIN
  UPDATE emma_task
  SET status = 'triggered',
      triggered_at = now(),
      updated_at = now()
  WHERE status = 'pending'
    AND due_at IS NOT NULL
    AND due_at <= now();

  GET DIAGNOSTICS triggered_count = ROW_COUNT;
  RETURN triggered_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Cron job: every 10 minutes, trigger due tasks directly in DB
SELECT cron.schedule(
  'emma_task_trigger',
  '*/10 * * * *',
  'SELECT trigger_due_emma_tasks();'
);
