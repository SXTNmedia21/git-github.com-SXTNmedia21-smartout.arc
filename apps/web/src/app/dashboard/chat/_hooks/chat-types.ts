import type { Database } from "@smartout/supabase/database.types";

// ── Database row types ───────────────────────────────────────
type Tables = Database["public"]["Tables"];

export type ChatConversationRow = Tables["chat_conversation"]["Row"];
export type ChatParticipantRow = Tables["chat_participant"]["Row"];
export type ChatMessageRow = Tables["chat_message"]["Row"];
export type ChatConversationType = Database["public"]["Enums"]["chat_conversation_type"];

// ── UI query result types ────────────────────────────────────

/** Profile info embedded in messages and participant lists */
export type ChatProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

/** A conversation with latest message preview and unread count */
export type ConversationWithPreview = ChatConversationRow & {
  participants: Array<{
    profile: ChatProfile;
    last_read_at: string;
    role: string;
  }>;
  last_message: {
    content: string;
    created_at: string;
    sender: ChatProfile;
  } | null;
  unread_count: number;
};

/** A message with sender profile and optional reply-to */
export type MessageWithSender = ChatMessageRow & {
  sender: ChatProfile;
  reply_to: {
    id: string;
    content: string;
    sender: ChatProfile;
  } | null;
};

/** Reaction map: emoji -> array of profile IDs */
export type ReactionMap = Record<string, string[]>;
