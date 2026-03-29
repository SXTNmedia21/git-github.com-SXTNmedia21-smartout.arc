-- Adds workspace lifecycle status enum and verification_deadline column.
-- New workspaces start as 'sandbox' until email is verified.
-- Existing workspaces are set to 'active' (already verified pre-migration).

-- New enum for workspace lifecycle states
CREATE TYPE workspace_status AS ENUM ('sandbox', 'active', 'suspended', 'archived');

-- Status column — defaults to sandbox so new workspaces enter quarantine automatically
ALTER TABLE workspace ADD COLUMN status workspace_status NOT NULL DEFAULT 'sandbox';

-- All pre-existing workspaces are already verified, promote them to active
UPDATE workspace SET status = 'active';

-- Deadline for sandbox expiry (NULL for active/suspended/archived workspaces)
ALTER TABLE workspace ADD COLUMN verification_deadline timestamptz;

-- Helper: check whether a given auth.users row has a confirmed email.
-- Used by sandbox enforcement logic (middleware, cleanup cron) to decide
-- whether a workspace can exit sandbox without hitting auth.users directly.
CREATE OR REPLACE FUNCTION is_email_verified(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (email_confirmed_at IS NOT NULL)
  FROM auth.users
  WHERE id = user_uuid;
$$;

-- Partial index to make sandbox cleanup cron queries fast —
-- only indexes the rows that the cron actually needs to scan.
CREATE INDEX idx_workspace_sandbox_deadline
  ON workspace (status, verification_deadline)
  WHERE status = 'sandbox';
