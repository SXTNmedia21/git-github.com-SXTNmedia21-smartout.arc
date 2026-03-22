import type { Database } from "@smartout/supabase/database.types";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

// Database row types
export type ChannelRow = Tables["channel"]["Row"];
export type ChannelMemberRow = Tables["channel_member"]["Row"];
export type ChannelMessageRow = Tables["channel_message"]["Row"];

// Enum types
export type ChannelType = Enums["comm_channel_type"];
export type MessageType = Enums["channel_message_type"];
export type OriginType = Enums["channel_origin_type"];
export type DeliveryMode = Enums["channel_delivery_mode"];
export type MemberRole = Enums["channel_member_role"];

// Profile info embedded in messages and member lists
export type ChannelProfile = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
};

// RPC return type: channel with preview (from get_my_channels)
export type ChannelWithPreview = {
  channel_id: string;
  workspace_id: string;
  channel_type: ChannelType;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  is_read_only: boolean;
  is_archived: boolean;
  audio_policy: string;
  video_policy: string;
  member_count: number;
  unread_count: number;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_name: string | null;
  last_message_sender_avatar: string | null;
};

// Reaction from JSON aggregate
export type ReactionEntry = {
  emoji: string;
  profile_id: string;
};

// Attachment from JSON aggregate
export type AttachmentEntry = {
  id: string;
  file_type: string;
  url: string;
  filename: string;
  size_bytes: number;
};

// RPC return type: message with sender (from get_channel_messages)
export type MessageWithSender = {
  message_id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  sender_role: string | null;
  content: string;
  message_type: MessageType;
  origin_type: OriginType;
  visibility_scope: string;
  reply_to_id: string | null;
  reply_to_content: string | null;
  reply_to_sender_name: string | null;
  system_data: Record<string, unknown> | null;
  is_pinned: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  client_message_id: string | null;
  created_at: string;
  reactions: ReactionEntry[];
  attachments: AttachmentEntry[];
};

// Unread count per channel
export type UnreadCount = {
  channel_id: string;
  unread_count: number;
};

// Channel member with profile info
export type ChannelMemberWithProfile = ChannelMemberRow & {
  profile: ChannelProfile;
};

// Group channels by type for the sidebar list
export type ChannelGroup = {
  type: ChannelType;
  label: string;
  channels: ChannelWithPreview[];
};
