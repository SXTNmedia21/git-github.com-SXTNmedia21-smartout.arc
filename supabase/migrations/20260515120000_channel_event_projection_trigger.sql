-- ============================================
-- 20260515120000_channel_event_projection_trigger.sql
-- Project whitelisted engine_event rows into channel_event (ADR-0160).
-- ============================================
-- ADR-0160: channel_event is the trigger-populated projection of
-- engine_event into Komm UI space; engine_event remains single source
-- of truth. Helpdesk Phase 0 Task 2.2 — closes the 2026-04-13 dead-infra
-- deadline by wiring channel_event to its first real consumer.
--
-- Projection rules:
--   1. Whitelist: event_type LIKE 'channel.%' OR LIKE 'helpdesk.%'
--   2. Required: payload->>'channel_id' resolves to a UUID
--   3. Best-effort: any projection failure RAISES NOTICE and continues —
--      engine_event INSERT is NEVER blocked by projection errors
--   4. Idempotency: carries engine_event.idempotency_key forward so the
--      channel_event UNIQUE INDEX dedupes retries
--   5. Source attribution: source='engine_event', source_id=engine_event.id
-- ============================================

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.project_engine_event_to_channel_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_channel_id uuid;
  v_channel_exists boolean;
BEGIN
  -- Whitelist: only project channel-domain or helpdesk-domain events.
  IF NEW.event_type NOT LIKE 'channel.%' AND NEW.event_type NOT LIKE 'helpdesk.%' THEN
    RETURN NEW;
  END IF;

  -- Required: channel_id in payload, parseable as UUID.
  BEGIN
    v_channel_id := (NEW.payload->>'channel_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'channel_event projection: event % has non-UUID channel_id — skipping', NEW.id;
    RETURN NEW;
  END;

  IF v_channel_id IS NULL THEN
    RAISE NOTICE 'channel_event projection: event % has no channel_id in payload — skipping', NEW.id;
    RETURN NEW;
  END IF;

  -- Verify channel exists and belongs to the same workspace (defense-in-depth).
  SELECT EXISTS (
    SELECT 1 FROM public.channel
    WHERE id = v_channel_id
      AND workspace_id = NEW.workspace_id
  ) INTO v_channel_exists;

  IF NOT v_channel_exists THEN
    RAISE NOTICE 'channel_event projection: channel % not in workspace % — skipping event %',
      v_channel_id, NEW.workspace_id, NEW.id;
    RETURN NEW;
  END IF;

  -- Best-effort insert. Any failure logs a NOTICE and lets the engine_event
  -- INSERT proceed — projection must NEVER block source-of-truth writes.
  BEGIN
    INSERT INTO public.channel_event (
      channel_id,
      workspace_id,
      event_type,
      source,
      source_id,
      payload,
      correlation_id,
      idempotency_key
    ) VALUES (
      v_channel_id,
      NEW.workspace_id,
      NEW.event_type,
      'engine_event',
      NEW.id::text,
      NEW.payload,
      NULL,
      -- Derive a per-channel idempotency key so the same engine_event
      -- can't produce duplicate channel_event rows on retry.
      CASE
        WHEN NEW.idempotency_key IS NOT NULL
          THEN 'engine:' || NEW.idempotency_key
        ELSE 'engine:' || NEW.id::text
      END
    );
  EXCEPTION WHEN unique_violation THEN
    -- Idempotency key collision — already projected. Silent no-op.
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'channel_event projection failed for event % (channel %): % — %',
      NEW.id, v_channel_id, SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.project_engine_event_to_channel_event()
IS 'ADR-0160 projection: whitelist (channel.*, helpdesk.*) engine_event rows into channel_event. Best-effort — NEVER blocks engine_event INSERT.';

DROP TRIGGER IF EXISTS engine_event_to_channel_event ON public.engine_event;

CREATE TRIGGER engine_event_to_channel_event
  AFTER INSERT ON public.engine_event
  FOR EACH ROW
  EXECUTE FUNCTION public.project_engine_event_to_channel_event();

COMMENT ON TRIGGER engine_event_to_channel_event ON public.engine_event
IS 'ADR-0160: projects whitelisted engine_event rows into channel_event for Komm UI consumption.';
