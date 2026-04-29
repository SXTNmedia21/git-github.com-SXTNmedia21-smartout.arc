"use client";

/**
 * use-komm-tools.ts — Botsson read tools for the komm (channels + chat) surface.
 *
 * Exposes 5 read tools (no writes — those need C4 authority + a confirmation
 * flow and ship in a follow-up sortie):
 *
 *   listChannels         — all channels visible to the user, grouped by type
 *   getActiveChannel     — currently open channel (or null when none selected)
 *   getRecentMessages    — last N messages from the active channel
 *   getUnreadCount       — total + per-channel unread breakdown
 *   getMyHelpdeskCount   — open helpdesk tickets assigned to the current user
 *
 * Pattern follows use-oversikt-tools.ts: tools are memoised once with stable
 * refs, while a `dataRef` is refreshed every render so implementations always
 * read live data without churning the harness registry.
 */

import { useEffect, useMemo, useRef } from "react";
import type {
  ClientToolDefinition,
  ClientToolImplementation,
  ClientToolKit,
} from "@smartout/agent-sdk";
import type {
  ChannelGroup,
  ChannelWithPreview,
  MessageWithSender,
  UnreadCount,
} from "../_hooks/channel-types";

export type KommToolInput = {
  /** Selected surface — "channels" (groups) or "chat" (DMs). */
  surface: "channels" | "chat";
  /** All channel groups (from useChannels). */
  channelGroups: ChannelGroup[];
  /** Currently active channel id — null when none selected. */
  activeChannelId: string | null;
  /** Cached messages for active channel (newest first, paged). */
  activeChannelMessages: MessageWithSender[];
  /** Per-channel unread counts (from useUnreadCounts). */
  unreadCounts: UnreadCount[];
  /** My open helpdesk tickets count (from useMyHelpdeskCount). */
  myHelpdeskCount: number;
};

/* ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function flattenChannels(groups: ChannelGroup[]): ChannelWithPreview[] {
  return groups.flatMap((g) => g.channels);
}

function findActiveChannel(
  groups: ChannelGroup[],
  activeChannelId: string | null,
): ChannelWithPreview | null {
  if (!activeChannelId) return null;
  for (const g of groups) {
    const ch = g.channels.find((c) => c.channel_id === activeChannelId);
    if (ch) return ch;
  }
  return null;
}

function summarizeChannel(ch: ChannelWithPreview) {
  return {
    channel_id: ch.channel_id,
    type: ch.channel_type,
    name: ch.name ?? ch.other_member_name ?? "(uten navn)",
    description: ch.description,
    member_count: ch.member_count,
    unread_count: ch.unread_count,
    last_message_at: ch.last_message_at,
    last_message_preview: ch.last_message_content,
    last_sender: ch.last_message_sender_name,
    is_read_only: ch.is_read_only,
    is_archived: ch.is_archived,
  };
}

/* ━━━ Hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const RECENT_MESSAGE_LIMIT = 20;

export function useKommTools(input: KommToolInput): ClientToolKit {
  const dataRef = useRef(input);
  useEffect(() => {
    dataRef.current = input;
  });

  const definitions = useMemo<ClientToolDefinition[]>(
    () => [
      {
        temporaryTool: {
          modelToolName: "listChannels",
          description:
            "List all channels the user can see, grouped by type (department, team, session, custom, direct, news, skill). Includes member count, unread count and last-message preview. Use when the user asks 'hvilke kanaler har jeg?', 'hvor mye er ulest?', or wants an overview.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getActiveChannel",
          description:
            "Get details of the currently open channel — name, type, member count, unread count. Returns null when no channel is selected. Call this first when the user asks a question about 'this channel' / 'denne kanalen'.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getRecentMessages",
          description:
            "Get the last 20 messages from the currently active channel — sender, content, time, reactions, attachments. Use when the user asks 'hva har skjedd i denne kanalen?', 'hva sa NN?', or wants a recap.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getUnreadCount",
          description:
            "Get total unread message count and per-channel breakdown. Use when the user asks 'har jeg nye meldinger?', 'hvor mye er ulest?', or wants triage prioritization.",
          dynamicParameters: [],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "getMyHelpdeskCount",
          description:
            "Get the count of open helpdesk tickets currently assigned to the user (engine_state with status waiting or active). Use when the user asks 'hva er Min KØ?', 'hvor mange åpne saker har jeg?', or wants their personal queue size.",
          dynamicParameters: [],
          client: {},
        },
      },
    ],
    [],
  );

  const implementations = useMemo<Record<string, ClientToolImplementation>>(
    () => ({
      listChannels: () => {
        const d = dataRef.current;
        return JSON.stringify({
          surface: d.surface,
          totalChannels: flattenChannels(d.channelGroups).length,
          totalUnread: d.unreadCounts.reduce((sum, u) => sum + u.unread_count, 0),
          groups: d.channelGroups.map((g) => ({
            type: g.type,
            count: g.channels.length,
            channels: g.channels.map(summarizeChannel),
          })),
        });
      },

      getActiveChannel: () => {
        const d = dataRef.current;
        const active = findActiveChannel(d.channelGroups, d.activeChannelId);
        if (!active) {
          return JSON.stringify({
            available: false,
            reason: "Ingen kanal er åpen. Be brukeren velge en kanal først.",
          });
        }
        return JSON.stringify({
          available: true,
          channel: summarizeChannel(active),
        });
      },

      getRecentMessages: () => {
        const d = dataRef.current;
        if (!d.activeChannelId) {
          return JSON.stringify({
            available: false,
            reason: "Ingen kanal er åpen — kan ikke hente meldinger.",
          });
        }
        const messages = d.activeChannelMessages.slice(0, RECENT_MESSAGE_LIMIT);
        return JSON.stringify({
          available: true,
          channelId: d.activeChannelId,
          count: messages.length,
          messages: messages.map((m) => ({
            id: m.message_id,
            sender: m.sender_name,
            role: m.sender_role,
            content: m.content,
            type: m.message_type,
            createdAt: m.created_at,
            editedAt: m.edited_at,
            isPinned: m.is_pinned,
            replyToContent: m.reply_to_content,
            replyToSender: m.reply_to_sender_name,
            reactionCount: m.reactions.length,
            attachmentCount: m.attachments.length,
          })),
        });
      },

      getUnreadCount: () => {
        const d = dataRef.current;
        const total = d.unreadCounts.reduce((sum, u) => sum + u.unread_count, 0);
        const byChannel = d.unreadCounts.filter((u) => u.unread_count > 0);
        const enriched = byChannel.map((u) => {
          const ch = findActiveChannel(d.channelGroups, u.channel_id);
          return {
            channel_id: u.channel_id,
            unread_count: u.unread_count,
            channel_name: ch?.name ?? ch?.other_member_name ?? null,
            channel_type: ch?.channel_type ?? null,
          };
        });
        return JSON.stringify({
          totalUnread: total,
          channelsWithUnread: enriched.length,
          breakdown: enriched,
        });
      },

      getMyHelpdeskCount: () => {
        const d = dataRef.current;
        return JSON.stringify({
          openCount: d.myHelpdeskCount,
          source: "engine_state.helpdesk_query_lifecycle (status: waiting + active)",
        });
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
