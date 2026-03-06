SET search_path TO public, extensions;

-- shift_approval needs API key read policy
DROP POLICY IF EXISTS "api_key_read_shift_approval" ON shift_approval;
CREATE POLICY "api_key_read_shift_approval" ON shift_approval
  FOR SELECT USING (
    workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
  );
