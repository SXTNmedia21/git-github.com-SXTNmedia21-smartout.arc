"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { channelKeys } from "./channel-keys";
import type { MessageType } from "./channel-types";

/**
 * A communication entry — either a system message from a channel
 * or a planning event from the season module.
 */
export type CommunicationEntry = {
  id: string;
  type: "announcement" | "brief" | "handoff" | "reminder" | "summary" | "planning_event";
  title: string;
  content: string;
  channelName: string | null;
  senderName: string | null;
  targetDescription: string | null;
  date: string;
};

/** System message types we show in the overview */
const SYSTEM_TYPES: MessageType[] = ["announcement", "brief", "handoff", "reminder", "summary"];

export function useCommunicationOverview() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: [...channelKeys.all, "overview", workspaceId],
    staleTime: 30_000,
    queryFn: async (): Promise<CommunicationEntry[]> => {
      const supabase = createClient();
      const entries: CommunicationEntry[] = [];

      // 1. Fetch system messages across all channels the user has access to
      const { data: messages, error: msgError } = await supabase
        .from("channel_message")
        .select(
          `
          id,
          message_type,
          content,
          created_at,
          sender_id,
          visibility_scope,
          channel:channel!inner(name, channel_type)
        `,
        )
        .eq("workspace_id", workspaceId)
        .in("message_type", SYSTEM_TYPES)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!msgError && messages) {
        for (const msg of messages) {
          const ch = msg.channel as unknown as {
            name: string | null;
            channel_type: string;
          };
          entries.push({
            id: msg.id,
            type: msg.message_type as CommunicationEntry["type"],
            title: formatTypeLabel(msg.message_type),
            content: msg.content,
            channelName: ch.name,
            senderName: null,
            targetDescription: formatVisibility(msg.visibility_scope),
            date: msg.created_at,
          });
        }
      }

      // 2. Fetch planning events (upcoming + recent)
      const { data: events, error: evtError } = await supabase
        .from("planning_event")
        .select("planning_event_id, name, description, event_date, end_date, category")
        .eq("workspace_id", workspaceId)
        .gte("event_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .order("event_date", { ascending: false })
        .limit(50);

      if (!evtError && events) {
        for (const evt of events) {
          entries.push({
            id: evt.planning_event_id,
            type: "planning_event",
            title: evt.name,
            content: evt.description ?? "",
            channelName: null,
            senderName: null,
            targetDescription: evt.category,
            date: evt.event_date,
          });
        }
      }

      // Sort all entries by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return entries;
    },
  });
}

function formatTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    announcement: "Kunngjøring",
    brief: "Briefing",
    handoff: "Overlevering",
    reminder: "Påminnelse",
    summary: "Oppsummering",
  };
  return labels[type] ?? type;
}

function formatVisibility(scope: string): string {
  const labels: Record<string, string> = {
    all_members: "Alle medlemmer",
    admins: "Kun ledere",
    targeted_members: "Utvalgte",
  };
  return labels[scope] ?? scope;
}
