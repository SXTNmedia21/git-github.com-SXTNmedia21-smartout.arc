"use client";

/**
 * use-komm-tools.ts — Botsson tools for the komm (channels + chat) surface.
 *
 * Read tools (5):
 *   listChannels         — all channels visible to the user, grouped by type
 *   getActiveChannel     — currently open channel (or null when none selected)
 *   getRecentMessages    — last N messages from the active channel
 *   getUnreadCount       — total + per-channel unread breakdown
 *   getMyHelpdeskCount   — open helpdesk tickets assigned to the current user
 *
 * Action tools (3):
 *   sendMessage          — post a message in the active channel
 *   createChat           — create a 1:1 DM channel with another profile
 *   joinCall             — join the active call in a channel (audio/video)
 *
 * All actions delegate to existing TanStack mutation hooks (useSendMessage,
 * useCreateChannel) or the ActiveCallProvider — telemetry (emit) and RLS
 * (workspace_id, profile_id) are enforced there. Tools return JSON status
 * so Botsson can phrase confirmation/error responses to the user.
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

export type KommActionResult =
  | { ok: true; [k: string]: unknown }
  | { ok: false; reason: string; [k: string]: unknown };

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
  /**
   * ADR-0078: voice channel guard. When "voice", sendMessage + createChat
   * executors reject immediately without calling the mutation. Undefined
   * means channel is unknown — guard is skipped (safe degraded mode).
   * KommToolsBridge propagates this from its sessionChannel prop.
   */
  sessionChannel?: "voice" | "chat";
  /** Send a message to the active channel. Bridge wires this to useSendMessage. */
  onSendMessage: (args: { content: string; replyToId?: string }) => Promise<KommActionResult>;
  /** Create a 1:1 DM channel with another profile. Bridge wires this to useCreateChannel. */
  onCreateChat: (args: { otherProfileId: string; name?: string }) => Promise<KommActionResult>;
  /** Join the active call in a channel. Bridge wires this to ActiveCallProvider + LiveKit. */
  onJoinCall: (args: { channelId?: string; withVideo?: boolean }) => Promise<KommActionResult>;
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
      {
        temporaryTool: {
          modelToolName: "sendMessage",
          description:
            "Send a text message to the currently active channel. Use when the user says 'send melding ...', 'svar med ...', 'skriv at ...'. Always confirm the wording with the user verbally before invoking. Fails when no channel is open.",
          dynamicParameters: [
            {
              name: "content",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "The exact message text to send (already confirmed with the user).",
              },
              required: true,
            },
            {
              name: "replyToId",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "Optional message_id to reply to. Omit for a top-level message.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "createChat",
          description:
            "Create a 1:1 direct-message channel with another workspace member by profile_id. If the DM already exists, it returns the existing channel_id. Use when the user says 'start chat med NN', 'send DM til NN'. The caller must look up the profile_id first via the people directory.",
          dynamicParameters: [
            {
              name: "otherProfileId",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "The profile_id (UUID) of the other person.",
              },
              required: true,
            },
            {
              name: "name",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "Optional channel name. DMs typically derive name from members.",
              },
              required: false,
            },
          ],
          client: {},
        },
      },
      {
        temporaryTool: {
          modelToolName: "joinCall",
          description:
            "Join the active call in a channel — audio by default, video optional. If channelId is omitted, joins the call in the currently active channel. Use when the user says 'bli med på samtalen', 'join call', 'svar på anropet'. Fails when no channel is open and no channelId is supplied, or LiveKit auth fails.",
          dynamicParameters: [
            {
              name: "channelId",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "string",
                description: "Optional channel_id. Defaults to the active channel.",
              },
              required: false,
            },
            {
              name: "withVideo",
              location: "PARAMETER_LOCATION_BODY",
              schema: {
                type: "boolean",
                description: "Start with camera on. Default false.",
              },
              required: false,
            },
          ],
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

      sendMessage: async (args: unknown) => {
        const d = dataRef.current;

        // ADR-0078: voice channel guard — writes are forbidden over voice.
        // Return before any mutation call. Never default-allows on voice.
        if (d.sessionChannel === "voice") {
          return JSON.stringify({
            ok: false,
            reason:
              "Kan ikke sende meldinger eller opprette kanaler over voice. Bytt til chat.",
          });
        }

        const params = (args ?? {}) as { content?: unknown; replyToId?: unknown };
        const content = typeof params.content === "string" ? params.content.trim() : "";
        const replyToId = typeof params.replyToId === "string" ? params.replyToId : undefined;

        if (!content) {
          return JSON.stringify({ ok: false, reason: "Tom melding — content er påkrevd." });
        }
        if (!d.activeChannelId) {
          return JSON.stringify({
            ok: false,
            reason: "Ingen kanal er åpen. Be brukeren velge en kanal først.",
          });
        }

        const result = await d.onSendMessage({ content, replyToId });
        return JSON.stringify(result);
      },

      createChat: async (args: unknown) => {
        const d = dataRef.current;

        // ADR-0078: voice channel guard — channel creation is forbidden over voice.
        if (d.sessionChannel === "voice") {
          return JSON.stringify({
            ok: false,
            reason:
              "Kan ikke sende meldinger eller opprette kanaler over voice. Bytt til chat.",
          });
        }

        const params = (args ?? {}) as { otherProfileId?: unknown; name?: unknown };
        const otherProfileId =
          typeof params.otherProfileId === "string" ? params.otherProfileId.trim() : "";
        const name = typeof params.name === "string" ? params.name : undefined;

        if (!otherProfileId) {
          return JSON.stringify({
            ok: false,
            reason: "otherProfileId mangler — slå opp profilen først.",
          });
        }

        const result = await d.onCreateChat({ otherProfileId, name });
        return JSON.stringify(result);
      },

      joinCall: async (args: unknown) => {
        const d = dataRef.current;
        const params = (args ?? {}) as { channelId?: unknown; withVideo?: unknown };
        const channelId =
          typeof params.channelId === "string"
            ? params.channelId
            : (d.activeChannelId ?? undefined);
        const withVideo = params.withVideo === true;

        if (!channelId) {
          return JSON.stringify({
            ok: false,
            reason: "Ingen kanal valgt og ingen channelId oppgitt.",
          });
        }

        const result = await d.onJoinCall({ channelId, withVideo });
        return JSON.stringify(result);
      },
    }),
    [],
  );

  return useMemo(() => ({ definitions, implementations }), [definitions, implementations]);
}
