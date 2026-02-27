-- Enums
CREATE TYPE notification_mode AS ENUM ('training', 'work', 'community');
CREATE TYPE notification_channel AS ENUM ('push', 'sms', 'email', 'voice');
CREATE TYPE notification_status AS ENUM ('pending', 'processing', 'delivered', 'failed', 'suppressed');

-- Notification Preferences
CREATE TABLE public.notification_preference (
  user_id uuid PRIMARY KEY REFERENCES public.user_identity(user_id) ON DELETE CASCADE,
  
  -- Mode Overrides
  training_enabled boolean DEFAULT true,
  work_enabled boolean DEFAULT true,
  community_enabled boolean DEFAULT true,
  
  -- Channel Defaults
  push_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  email_enabled boolean DEFAULT true,
  
  -- Quiet Hours (DND)
  quiet_hours_start time,
  quiet_hours_end time,
  quiet_hours_timezone text DEFAULT 'Europe/Oslo',
  
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER set_notification_pref_updated_at BEFORE UPDATE ON public.notification_preference FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification Outbox (Polled by Edge Functions)
CREATE TABLE public.notification_outbox (
  id bigserial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id),
  recipient_id uuid NOT NULL REFERENCES public.profile(profile_id),
  
  -- Classification
  mode notification_mode NOT NULL,
  priority smallint NOT NULL DEFAULT 0, -- 0 normal, 1 high, 2 urgent
  
  -- Content Payload
  title text NOT NULL,
  body text NOT NULL,
  action_url text,
  metadata jsonb DEFAULT '{}',
  
  -- Required Channels (Array, decides where this is force-pushed or standard routed)
  allowed_channels notification_channel[] DEFAULT '{push, email}', 
  
  -- Status Tracking
  status notification_status DEFAULT 'pending',
  error_log text,
  
  -- Timing for delay/scheduling
  scheduled_for timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for the Edge Function Poller
CREATE INDEX idx_outbox_pending ON public.notification_outbox(status, scheduled_for) WHERE status = 'pending';

-- Service Role write capabilities
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System manages outbox" ON public.notification_outbox
  FOR ALL
  WITH CHECK (TRUE);
