"use client";

/**
 * useShiftChat.ts — Manages two chat channels for an active shift session.
 *
 * Session chat: a group conversation tied to the department session, visible
 * to all session participants. Shift thread: a DM-style conversation tied to
 * the specific shift, for leader<>employee direct messages.
 *
 * Both channels are lazily created on first message send (upsert pattern) to
 * avoid creating empty conversations. Realtime subscriptions keep both message
 * lists live while the hook is mounted.
 *
 * Connected to: ShiftClock chat tab component
 */

import { useContext, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

// ── Query key factory ─────────────────────────────────────────

const shiftChatKeys = {
  sessionMessages: (sessionId: string) => ["shift-chat", "session", sessionId] as const,
  shiftMessages: (shiftId: string) => ["shift-chat", "shift", shiftId] as const,
  conversation: (type: "session" | "shift", sourceId: string) =>
    ["shift-chat-conversation", type, sourceId] as const,
};

// ── Types ─────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    profile_id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

// ── Internal helpers ──────────────────────────────────────────

/**
 * Fetch or create a conversation for a given source entity.
 * Uses upsert semantics: find existing first, create only if missing.
 * Returns the conversation id.
 */
async function ensureConversation(
  supabase: ReturnType<typeof createClient>,
  {
    workspaceId,
    profileId,
    type,
    sourceType,
    sourceId,
  }: {
    workspaceId: string;
    profileId: string;
    type: "group" | "dm";
    sourceType: "session" | "shift";
    sourceId: string;
  },
): Promise<string> {
  // Try to find an existing conversation for this source entity
  const { data: existing } = await supabase
    .from("chat_conversation")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("type", type)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();

  if (existing) return existing.id;

  // None found — create it and add the current user as a participant
  const { data: created, error } = await supabase
    .from("chat_conversation")
    .insert({
      workspace_id: workspaceId,
      type,
      source_type: sourceType,
      source_id: sourceId,
      created_by: profileId,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.from("chat_participant").insert({
    conversation_id: created.id,
    profile_id: profileId,
    role: "member",
  });

  return created.id;
}

/** Fetch messages for a known conversation id. */
async function fetchMessages(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_message")
    .select(
      "id, conversation_id, sender_id, content, created_at, sender:profile(profile_id, display_name, avatar_url)",
    )
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ChatMessage[]; // SAFETY: Supabase join returns union type; runtime shape matches the cast
}

// ── Hook ──────────────────────────────────────────────────────

export function useShiftChat({
  departmentSessionId,
  scheduleShiftId,
}: {
  departmentSessionId: string | null;
  scheduleShiftId: string | null;
}) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  const workspaceId = workspace.workspace_id;

  // Stable refs to conversation ids — populated lazily on first send,
  // or eagerly when we can look them up without creating.
  const sessionConvId = useRef<string | null>(null);
  const shiftConvId = useRef<string | null>(null);

  // ── Queries: look up existing conversation ids (no auto-create) ──

  const sessionConvQuery = useQuery({
    queryKey: shiftChatKeys.conversation("session", departmentSessionId ?? ""),
    enabled: !!departmentSessionId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("chat_conversation")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("type", "group")
        .eq("source_type", "session")
        .eq("source_id", departmentSessionId!)
        .maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const shiftConvQuery = useQuery({
    queryKey: shiftChatKeys.conversation("shift", scheduleShiftId ?? ""),
    enabled: !!scheduleShiftId,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("chat_conversation")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("type", "dm")
        .eq("source_type", "shift")
        .eq("source_id", scheduleShiftId!)
        .maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sync resolved ids into refs so the send mutations can access them without
  // creating new closures every render. Must run in effects, not during render.
  useEffect(() => {
    if (sessionConvQuery.data) sessionConvId.current = sessionConvQuery.data;
  }, [sessionConvQuery.data]);

  useEffect(() => {
    if (shiftConvQuery.data) shiftConvId.current = shiftConvQuery.data;
  }, [shiftConvQuery.data]);

  // ── Queries: messages ─────────────────────────────────────────

  const sessionMessagesQuery = useQuery<ChatMessage[]>({
    queryKey: shiftChatKeys.sessionMessages(departmentSessionId ?? ""),
    enabled: !!sessionConvQuery.data,
    queryFn: () => fetchMessages(createClient(), sessionConvQuery.data!),
  });

  const shiftMessagesQuery = useQuery<ChatMessage[]>({
    queryKey: shiftChatKeys.shiftMessages(scheduleShiftId ?? ""),
    enabled: !!shiftConvQuery.data,
    queryFn: () => fetchMessages(createClient(), shiftConvQuery.data!),
  });

  // ── Mutations: send messages ──────────────────────────────────

  const sendSessionMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!departmentSessionId || !profileId) throw new Error("No active session");

      const supabase = createClient();

      // Ensure the conversation exists (creates on first use)
      const convId = await ensureConversation(supabase, {
        workspaceId,
        profileId,
        type: "group",
        sourceType: "session",
        sourceId: departmentSessionId,
      });
      sessionConvId.current = convId;

      const { error } = await supabase.from("chat_message").insert({
        conversation_id: convId,
        sender_id: profileId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "chat message_sent",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          data: { channel_id: sessionConvId.current ?? "", has_attachments: false },
        },
      });
    },
    onSettled: () => {
      // Invalidate both the conversation lookup and the messages
      void queryClient.invalidateQueries({
        queryKey: shiftChatKeys.conversation("session", departmentSessionId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: shiftChatKeys.sessionMessages(departmentSessionId ?? ""),
      });
    },
  });

  const sendShiftMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!scheduleShiftId || !profileId) throw new Error("No active shift");

      const supabase = createClient();

      const convId = await ensureConversation(supabase, {
        workspaceId,
        profileId,
        type: "dm",
        sourceType: "shift",
        sourceId: scheduleShiftId,
      });
      shiftConvId.current = convId;

      const { error } = await supabase.from("chat_message").insert({
        conversation_id: convId,
        sender_id: profileId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void emit({
        event: "chat message_sent",
        workspace_id: workspaceId,
        actor_id: profileId ?? "",
        properties: {
          data: { channel_id: shiftConvId.current ?? "", has_attachments: false },
        },
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: shiftChatKeys.conversation("shift", scheduleShiftId ?? ""),
      });
      void queryClient.invalidateQueries({
        queryKey: shiftChatKeys.shiftMessages(scheduleShiftId ?? ""),
      });
    },
  });

  // ── Realtime subscriptions ────────────────────────────────────

  useEffect(() => {
    const convId = sessionConvId.current;
    if (!convId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`shift-chat:session:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${convId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: shiftChatKeys.sessionMessages(departmentSessionId ?? ""),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionConvQuery.data, departmentSessionId, queryClient]);

  useEffect(() => {
    const convId = shiftConvId.current;
    if (!convId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`shift-chat:shift:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message",
          filter: `conversation_id=eq.${convId}`,
        },
        () => {
          void queryClient.invalidateQueries({
            queryKey: shiftChatKeys.shiftMessages(scheduleShiftId ?? ""),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [shiftConvQuery.data, scheduleShiftId, queryClient]);

  // ── Public API ────────────────────────────────────────────────

  const isLoading =
    sessionMessagesQuery.isLoading ||
    shiftMessagesQuery.isLoading ||
    sendSessionMessageMutation.isPending ||
    sendShiftMessageMutation.isPending;

  return {
    sessionMessages: sessionMessagesQuery.data ?? [],
    shiftMessages: shiftMessagesQuery.data ?? [],
    sendSessionMessage: (content: string) => sendSessionMessageMutation.mutateAsync(content),
    sendShiftMessage: (content: string) => sendShiftMessageMutation.mutateAsync(content),
    isLoading,
  };
}
