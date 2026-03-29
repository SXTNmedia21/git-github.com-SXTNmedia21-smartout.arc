-- Add is_featured flag to chat_conversation for admin-promoted channels.
-- Featured channels are visually highlighted and appear in their own section.

ALTER TABLE public.chat_conversation
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.chat_conversation.is_featured IS
  'Admin-promoted channel — displayed in "Feta kanaler" section with visual highlight.';
