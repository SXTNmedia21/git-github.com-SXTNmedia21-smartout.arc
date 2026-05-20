-- 20260621000000_contract_event_trigger_url_update.sql
-- SM-2-followup-contracts: update notification action_urls in dispatch_contract_notification()
-- from /dashboard/contracts to /dashboard/people/contracts.
--
-- Why: /dashboard/contracts/* routes moved to /dashboard/people/contracts/* as part of the
--      Ansatte hub consolidation (SM-2-followup-contracts, 2026-05-19).
--      Next.js redirect() stubs at the old paths cover any historic DB rows in notification_outbox
--      that were written before this migration — those old URLs still resolve via redirect.
--      New notifications fired after this migration point directly to the correct new path.
--
-- How: CREATE OR REPLACE FUNCTION replaces the function body only.
--      Trigger attachment (contract_event_notification_trigger) is unchanged.
--      Function signature is identical to 20260520120000_extend_contract_event_trigger.sql.

CREATE OR REPLACE FUNCTION dispatch_contract_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract        record;
  v_employee_profile_id uuid;
  v_employee_name   text;
  v_admin_profile_id uuid;
  v_workspace_id    uuid;
  v_event_key       text;
  v_title           text;
  v_body            text;
  v_action_url      text;
  v_priority        smallint;
  v_channels        notification_channel[];
  v_metadata        jsonb;
  v_notify_employee boolean := false;
  v_notify_admin    boolean := false;
BEGIN
  -- Fetch the contract row for recipient and workspace info
  SELECT c.contract_id, c.workspace_id, c.created_by,
         c.recipient_name, c.recipient_email
    INTO v_contract
    FROM contract c
   WHERE c.contract_id = NEW.contract_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_workspace_id := COALESCE(NEW.workspace_id, v_contract.workspace_id);
  v_admin_profile_id := v_contract.created_by;

  -- Resolve employee profile via recipient_email -> user_identity -> profile
  IF v_contract.recipient_email IS NOT NULL AND v_workspace_id IS NOT NULL THEN
    SELECT p.profile_id, p.display_name
      INTO v_employee_profile_id, v_employee_name
      FROM user_identity ui
      JOIN profile p ON p.user_id = ui.user_id
     WHERE ui.email = v_contract.recipient_email
       AND p.workspace_id = v_workspace_id
     LIMIT 1;
  END IF;

  -- Fallback name from contract if profile not found
  IF v_employee_name IS NULL THEN
    v_employee_name := COALESCE(v_contract.recipient_name, 'Ansatt');
  END IF;

  -- Build shared metadata (no PII — only name and IDs)
  v_metadata := jsonb_build_object(
    'contract_id', NEW.contract_id,
    'employee_name', v_employee_name,
    'workspace_id', v_workspace_id
  );

  IF v_employee_profile_id IS NOT NULL THEN
    v_metadata := v_metadata || jsonb_build_object('profile_id', v_employee_profile_id);
  END IF;

  -- Route by event_type
  CASE NEW.event_type

    WHEN 'contract_created' THEN
      v_notify_employee := true;
      v_event_key := 'contract.created';
      v_title := 'Ny kontrakt opprettet';
      v_body := 'En ny kontrakt er opprettet for deg';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['push', 'in_app']::notification_channel[];

    WHEN 'contract_sent' THEN
      v_notify_employee := true;
      v_event_key := 'contract.sent';
      v_title := 'Kontrakt klar for signering';
      v_body := 'Du har en kontrakt som venter på signering';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['email', 'push', 'in_app']::notification_channel[];

    WHEN 'contract_viewed' THEN
      v_notify_admin := true;
      v_event_key := 'contract.viewed';
      v_title := 'Kontrakt åpnet';
      v_body := v_employee_name || ' har åpnet kontrakten';
      v_action_url := '/dashboard/people';
      v_priority := 1;
      v_channels := ARRAY['in_app']::notification_channel[];

    WHEN 'contract_signed' THEN
      v_notify_employee := true;
      v_notify_admin := true;
      v_event_key := 'contract.signed';
      v_title := 'Kontrakt signert';
      v_body := v_employee_name || ' har signert kontrakten';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['email', 'push', 'in_app']::notification_channel[];

    WHEN 'contract_declined' THEN
      v_notify_admin := true;
      v_event_key := 'contract.declined';
      v_title := 'Kontrakt avslått';
      v_body := v_employee_name || ' har avslått kontrakten';
      v_action_url := '/dashboard/people';
      v_priority := 1;
      v_channels := ARRAY['email', 'in_app']::notification_channel[];

    WHEN 'contract_expired' THEN
      v_notify_employee := true;
      v_notify_admin := true;
      v_event_key := 'contract.expired';
      v_title := 'Kontrakt utløpt';
      v_body := 'Kontrakten for ' || v_employee_name || ' har utløpt';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['email', 'in_app']::notification_channel[];

    WHEN 'contract_cancelled' THEN
      -- Added 2026-04-30: cancellation was missing a CASE branch — admin was never notified.
      v_notify_admin := true;
      v_event_key := 'contract.cancelled';
      v_title := 'Kontrakt kansellert';
      v_body := 'Kontrakten for ' || v_employee_name || ' ble kansellert';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['in_app']::notification_channel[];

    WHEN 'intake_complete' THEN
      v_notify_admin := true;
      v_event_key := 'contract.intake_completed';
      v_title := 'Onboarding-data fullført';
      v_body := v_employee_name || ' har fullført alle påkrevde felt';
      v_action_url := '/dashboard/people';
      v_priority := 1;
      v_channels := ARRAY['in_app', 'push']::notification_channel[];

    WHEN 'reminder_due' THEN
      v_notify_employee := true;
      v_event_key := 'contract.reminder_due';
      v_title := 'Påminnelse: Signer kontrakt';
      v_body := 'Du har en kontrakt som venter på signering';
      v_action_url := '/dashboard/people/contracts';
      v_priority := 1;
      v_channels := ARRAY['email', 'push']::notification_channel[];

    ELSE
      -- Audit-only events (contract_send_failed, contract_send_queued, etc.)
      -- These are intentional no-ops: they record the event but trigger no notification.
      RETURN NEW;
  END CASE;

  -- Insert employee notification
  IF v_notify_employee AND v_employee_profile_id IS NOT NULL AND v_workspace_id IS NOT NULL THEN
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      v_workspace_id,
      v_employee_profile_id,
      'work',
      v_priority,
      v_title,
      CASE WHEN NEW.event_type = 'contract_signed'
        THEN 'Kontrakten din er signert'
        ELSE v_body
      END,
      v_action_url,
      v_metadata || jsonb_build_object(
        'event_key', v_event_key,
        'icon_type', 'contract'
      ),
      v_channels,
      'pending',
      now()
    );
  END IF;

  -- Insert admin notification
  IF v_notify_admin AND v_admin_profile_id IS NOT NULL AND v_workspace_id IS NOT NULL THEN
    INSERT INTO notification_outbox (
      workspace_id, recipient_id, mode, priority,
      title, body, action_url,
      metadata, allowed_channels, status, scheduled_for
    ) VALUES (
      v_workspace_id,
      v_admin_profile_id,
      'work',
      v_priority,
      v_title,
      v_body,
      v_action_url,
      v_metadata || jsonb_build_object(
        'event_key', v_event_key,
        'icon_type', 'contract'
      ),
      v_channels,
      'pending',
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dispatch_contract_notification() IS
  'Routes contract_event inserts to notification_outbox for employee and/or admin recipients.
   Updated 2026-04-30 (Decision 5A): added contract_cancelled branch; audit-only events
   (contract_send_failed, contract_send_queued) correctly fall through to ELSE → no notification.
   Updated 2026-06-21 (SM-2-followup-contracts): action_urls updated from /dashboard/contracts
   to /dashboard/people/contracts. Historic notification_outbox rows with old URLs are covered
   by Next.js redirect() stubs at the old paths.';
