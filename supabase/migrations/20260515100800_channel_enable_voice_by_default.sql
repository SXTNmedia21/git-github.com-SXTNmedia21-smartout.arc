-- Enable voice/video by default on channels
-- The original defaults ('disabled' / 'disabled') meant no channel could
-- receive a LiveKit token (livekit-token edge function 400s) and the UI
-- hid call buttons. Call capability is unlocked now, so default to
-- open_mic audio + optional video and backfill existing rows so the
-- feature shows up without requiring admins to toggle each channel.

ALTER TABLE public.channel
  ALTER COLUMN audio_policy SET DEFAULT 'open_mic',
  ALTER COLUMN video_policy SET DEFAULT 'optional';

-- Backfill existing channels that inherited the old disabled defaults.
-- Scope: all non-archived channels. Read-only news/announcement channels
-- keep their content guard via is_read_only; audio/video policies only
-- control mic/camera grants in LiveKit.
UPDATE public.channel
   SET audio_policy = 'open_mic'
 WHERE audio_policy = 'disabled';

UPDATE public.channel
   SET video_policy = 'optional'
 WHERE video_policy = 'disabled';
