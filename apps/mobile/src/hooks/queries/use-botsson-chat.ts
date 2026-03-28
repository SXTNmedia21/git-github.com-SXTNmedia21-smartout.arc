/**
 * Botsson chat hook — fetches the AI conversation for the current profile
 * and provides a function to send messages with full context payload.
 *
 * Each profile has one conversation WHERE type = 'ai'. If none exists,
 * we create one on first message send. All messages include context
 * (shift phase, role, department, trainee status) so Stage Engine can
 * personalize its responses.
 *
 * NOTE: Botsson still uses the legacy chat_conversation/chat_message schema.
 * BotssonMessage is a separate, simpler type — do NOT import MessageWithSender
 * from use-messages (that type is for the new channel schema only).
 */

import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useMyTasks } from "@/hooks/queries/use-my-tasks";
import { useShiftPhase } from "@/hooks/stores/use-shift-phase";
import type { Database } from "@smartout/supabase/database.types";

type ChatConversation = Database["public"]["Tables"]["chat_conversation"]["Row"];

/**
 * A simplified message type for Botsson's AI chat (chat_message schema).
 * Separate from MessageWithSender which maps the new channel_message schema.
 */
export type BotssonMessage = {
  id: string;
  conversation_id: string;
  content: string;
  sender_id: string;
  reply_to_id: string | null;
  is_system: boolean;
  attachments: unknown;
  reactions: unknown;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  /** Display name resolved from profile or "Mr. Botsson" for AI messages */
  senderName: string;
  /** Always null for AI chat (no avatars in this context) */
  senderAvatarUrl: string | null;
};
type ShiftPhase = "no_shift" | "before_shift" | "during_shift" | "after_shift";

/** Context payload attached to every message sent to Botsson */
export type BotssonContext = {
  profile_id: string;
  workspace_id: string;
  role: string;
  department_id: string | null;
  shift_phase: ShiftPhase;
  active_shift_id: string | null;
  active_session_id: string | null;
  trainee_status: boolean;
  pending_tasks_count: number;
};

const PAGE_SIZE = 50;
const STALE_TIME_MS = 60 * 1000;

/**
 * Finds the AI conversation for the current profile.
 * Returns null if none exists yet (will be created on first send).
 */
async function fetchAiConversation(profileId: string): Promise<ChatConversation | null> {
  // Find conversations where type = 'ai' and user is a participant
  const { data: participants, error: partError } = await supabase
    .from("chat_participant")
    .select("conversation_id")
    .eq("profile_id", profileId)
    .is("left_at", null);

  if (partError) throw partError;
  if (!participants || participants.length === 0) return null;

  const conversationIds = participants.map((p) => p.conversation_id);

  const { data: conversations, error: convError } = await supabase
    .from("chat_conversation")
    .select("*")
    .in("id", conversationIds)
    .eq("type", "ai")
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  if (convError) throw convError;
  return conversations;
}

/**
 * Creates a new AI conversation for the profile and adds them as participant.
 */
async function createAiConversation(
  profileId: string,
  workspaceId: string,
): Promise<ChatConversation> {
  const { data: conversation, error: convError } = await supabase
    .from("chat_conversation")
    .insert({
      type: "ai",
      workspace_id: workspaceId,
      created_by: profileId,
      name: "Mr. Botsson",
    })
    .select()
    .single();

  if (convError) throw convError;

  // Add the profile as participant
  const { error: partError } = await supabase.from("chat_participant").insert({
    conversation_id: conversation.id,
    profile_id: profileId,
  });

  if (partError) throw partError;

  return conversation;
}

/**
 * Fetches paginated messages for the Botsson conversation.
 */
async function fetchBotssonMessages(
  conversationId: string,
  pageParam: number,
): Promise<BotssonMessage[]> {
  const { data: messages, error } = await supabase
    .from("chat_message")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // For AI conversations, sender is either the user or "Mr. Botsson" (system)
  return messages.map((msg) => ({
    id: msg.id,
    conversation_id: msg.conversation_id,
    content: msg.content,
    sender_id: msg.sender_id,
    reply_to_id: msg.reply_to_id ?? null,
    is_system: msg.is_system,
    attachments: msg.attachments,
    reactions: msg.reactions,
    created_at: msg.created_at,
    updated_at: msg.updated_at,
    edited_at: msg.edited_at,
    deleted_at: msg.deleted_at,
    senderName: msg.is_system ? "Mr. Botsson" : "Du",
    senderAvatarUrl: null,
  }));
}

/**
 * Hook: provides the Botsson AI chat interface.
 *
 * Returns the conversation, messages, context-aware greeting, and a send function
 * that attaches the full context payload to each message.
 */
export function useBotssonChat() {
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const { data: tasks } = useMyTasks();
  const { phase, activeShift } = useShiftPhase();

  const profileId = profile?.profile_id ?? null;
  const workspaceId = profile?.workspace_id ?? null;

  // Fetch the AI conversation for this profile
  const { data: conversation, isLoading: isLoadingConversation } =
    useQuery<ChatConversation | null>({
      queryKey: ["botsson-conversation", profileId],
      queryFn: () => fetchAiConversation(profileId!),
      enabled: !!profileId,
      staleTime: STALE_TIME_MS,
    });

  const conversationId = conversation?.id ?? null;

  // Fetch messages if we have a conversation
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingMessages,
  } = useInfiniteQuery<BotssonMessage[]>({
    queryKey: ["botsson-messages", conversationId],
    queryFn: ({ pageParam }) => fetchBotssonMessages(conversationId!, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    staleTime: STALE_TIME_MS,
    enabled: !!conversationId,
  });

  // Flatten paginated messages into a single array
  const messages = useMemo(() => {
    if (!messagesData) return [] as BotssonMessage[];
    return messagesData.pages.flat();
  }, [messagesData]);

  // Build the current context payload
  const pendingTasksCount = useMemo(() => {
    if (!tasks) return 0;
    return tasks.filter((t) => t.status !== "completed" && t.status !== "skipped").length;
  }, [tasks]);

  const context: BotssonContext | null = useMemo(() => {
    if (!profileId || !workspaceId) return null;
    return {
      profile_id: profileId,
      workspace_id: workspaceId,
      role: profile?.role ?? "employee",
      department_id: profile?.department_id ?? null,
      shift_phase: phase,
      active_shift_id: activeShift?.schedule_shift_id ?? null,
      active_session_id: null, // Resolved by backend from active shift
      trainee_status: profile?.status === "trainee",
      pending_tasks_count: pendingTasksCount,
    };
  }, [profileId, workspaceId, profile, phase, activeShift, pendingTasksCount]);

  /**
   * Send a message to Botsson. Creates the conversation if it doesn't exist yet.
   * Attaches full context payload as message metadata for Stage Engine.
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!profileId || !workspaceId || !context) return;

      let targetConversationId = conversationId;

      // Create conversation on first message if it doesn't exist
      if (!targetConversationId) {
        const newConversation = await createAiConversation(profileId, workspaceId);
        targetConversationId = newConversation.id;

        // Update the conversation query cache
        queryClient.setQueryData(["botsson-conversation", profileId], newConversation);
      }

      const messageId = randomUUID();
      const now = new Date().toISOString();

      // Optimistic update: show message immediately
      const optimisticMessage: BotssonMessage = {
        id: messageId,
        conversation_id: targetConversationId,
        content,
        sender_id: profileId,
        reply_to_id: null,
        is_system: false,
        attachments: [],
        reactions: [],
        created_at: now,
        updated_at: now,
        edited_at: null,
        deleted_at: null,
        senderName: "Du",
        senderAvatarUrl: null,
      };

      queryClient.setQueryData(
        ["botsson-messages", targetConversationId],
        (old: { pages: BotssonMessage[][]; pageParams: number[] } | undefined) => {
          if (!old) {
            return { pages: [[optimisticMessage]], pageParams: [0] };
          }
          const newPages = [...old.pages];
          newPages[0] = [optimisticMessage, ...(newPages[0] ?? [])];
          return { ...old, pages: newPages };
        },
      );

      // Insert the message with context metadata in attachments field
      // Stage Engine reads context from attachments JSON
      const { error } = await supabase.from("chat_message").insert({
        id: messageId,
        conversation_id: targetConversationId,
        content,
        sender_id: profileId,
        is_system: false,
        attachments: [{ type: "botsson_context", ...context }],
        reactions: [],
      });

      if (error) {
        // Revert optimistic update on failure
        queryClient.invalidateQueries({ queryKey: ["botsson-messages", targetConversationId] });
        throw error;
      }
    },
    [profileId, workspaceId, conversationId, context, queryClient],
  );

  return {
    conversation,
    messages,
    isLoading: isLoadingConversation || isLoadingMessages,
    sendMessage,
    context,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    profileId,
  };
}
