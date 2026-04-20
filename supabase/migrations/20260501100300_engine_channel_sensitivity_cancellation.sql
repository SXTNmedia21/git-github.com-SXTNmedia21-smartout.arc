-- ADR-0077 + ADR-0078: Engine channel restriction, PII sensitivity tagging,
-- memory auto-expiration, and escalation cancellation.

-- ADR-0078: Channel restriction on engine processes.
-- Agents MUST check allowed_channels before dispatching to a channel.
-- Default includes all channels; restrict per-process for PII-sensitive flows.
ALTER TABLE public.engine_process
  ADD COLUMN IF NOT EXISTS allowed_channels TEXT[] NOT NULL DEFAULT ARRAY['chat', 'voice', 'sms', 'email', 'autonomous', 'telegram'];

COMMENT ON COLUMN public.engine_process.allowed_channels IS
  'Channels this process may use for interaction. Agents must check before dispatch (ADR-0078).';

-- ADR-0077: PII sensitivity tagging on engine memories.
-- Memories tagged ''pii'' or ''legal'' get special handling (encryption at rest, access logging).
ALTER TABLE public.engine_memory
  ADD COLUMN IF NOT EXISTS sensitivity TEXT DEFAULT 'normal' CHECK (sensitivity IN ('normal', 'pii', 'legal'));

COMMENT ON COLUMN public.engine_memory.sensitivity IS
  'Data sensitivity level. pii/legal memories get restricted access and auto-expiration (ADR-0077).';

-- Auto-expiration timestamp for sensitive memories.
-- A background job should delete expired rows periodically.
ALTER TABLE public.engine_memory
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.engine_memory.expires_at IS
  'Auto-expiration for sensitive memories. Background job deletes expired rows.';

-- Escalation cancellation: allows cancelling a delayed trigger before it fires.
ALTER TABLE public.engine_delayed_trigger
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.engine_delayed_trigger.cancelled_at IS
  'When set, this delayed trigger is cancelled and must not fire.';
