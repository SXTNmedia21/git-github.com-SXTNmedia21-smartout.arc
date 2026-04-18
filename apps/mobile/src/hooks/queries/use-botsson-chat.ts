/**
 * Botsson chat hook — fetches the AI conversation for the current profile
 * and provides a function to send messages with full context payload.
 *
 * Each profile has one conversation WHERE type = 'ai'. If none exists,
 * we create one on first message send. All messages include context
 * (shift phase, role, department, trainee status) so Stage Engine can
 * personalize its responses.
 *
 * Per ADR-0132 (mobile thin client): user messages are POSTed to the web
 * BFF (`/api/emma/chat`) which proxies to stage-engine. The BFF response
 * carries the assistant turn; this hook then writes BOTH turns to
 * `chat_message` for UI history persistence.
 *
 * Channel security (ADR-0078): we never send a `channel` field — the BFF
 * forces `channel: "chat"` server-side. Voice traffic gets its own
 * endpoint (Week 7+, LiveKit per ADR-0135).
 *
 * Session continuity: stage-engine `session_id` is persisted in MMKV
 * keyed by profileId. On 401/403/404/409 from the BFF the cached id
 * is cleared so the next turn starts a fresh session.
 *
 * NOTE: `chat_message` remains the UI history source while stage-engine
 * owns agent state in `engine_sessions`. Dual persistence is acknowledged
 * debt per Council 2026-04-17 — collapsing to a single store is Phase B.
 */

import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { storage } from "@/lib/cache/mmkv";
import { getEmmaChatUrl } from "@/lib/web-api";
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
 * MMKV-backed stage-engine session_id, scoped by profileId.
 *
 * Cleared on:
 * - workspace switch (a different profileId reads a different key)
 * - sign-out (handled by app-level MMKV reset)
 * - BFF response 401/403/404/409 (caller invalidates explicitly)
 */
const SESSION_KEY_PREFIX = "cache:botsson-session-id";
const sessionKey = (profileId: string) => `${SESSION_KEY_PREFIX}:${profileId}`;

function loadStoredSessionId(profileId: string): string | null {
  try {
    return storage.getString(sessionKey(profileId)) ?? null;
  } catch {
    return null;
  }
}

function persistSessionId(profileId: string, sessionId: string | null) {
  try {
    if (sessionId) storage.set(sessionKey(profileId), sessionId);
    else storage.delete(sessionKey(profileId));
  } catch {
    /* MMKV unavailable — non-fatal, session restarts each turn */
  }
}

/** Botsson "system" sender — placeholder until stage-engine writes its own bot identity. */
const BOTSSON_SENDER_ID = "00000000-0000-0000-0000-000000000000";

type BffChatResponse = {
  text: string;
  sessionId: string;
  intent?: { capability: string; confidence: number };
};

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
   * Send a message to Botsson via the web BFF (ADR-0132).
   *
   * Flow:
   * 1. Create conversation if needed (UI history persistence)
   * 2. Optimistically render user message
   * 3. POST to BFF emma/chat with Bearer token (no `channel` — server forces "chat")
   * 4. On 401/403/404/409: clear stored session_id, surface error
   * 5. On 200: persist returned session_id; write BOTH turns to chat_message
   *    AFTER successful response (avoids orphan user-message-without-reply)
   */
  const sendMessage = useCallback(
    async (content: string) => {
      if (!profileId || !workspaceId || !context) return;

      let targetConversationId = conversationId;

      // Create conversation on first message if it doesn't exist
      if (!targetConversationId) {
        const newConversation = await createAiConversation(profileId, workspaceId);
        targetConversationId = newConversation.id;
        queryClient.setQueryData(["botsson-conversation", profileId], newConversation);
      }

      const userMessageId = randomUUID();
      const now = new Date().toISOString();

      // Optimistic UI update — render the user turn immediately
      const optimisticMessage: BotssonMessage = {
        id: userMessageId,
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
          if (!old) return { pages: [[optimisticMessage]], pageParams: [0] };
          const newPages = [...old.pages];
          newPages[0] = [optimisticMessage, ...(newPages[0] ?? [])];
          return { ...old, pages: newPages };
        },
      );

      // Resolve auth — Bearer token from the active Supabase session
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr || !sessionData.session?.access_token) {
        queryClient.invalidateQueries({ queryKey: ["botsson-messages", targetConversationId] });
        throw new Error("Ikke pålogget");
      }

      // POST to web BFF — proxies to stage-engine, forces channel: "chat"
      let res: Response;
      try {
        res = await fetch(getEmmaChatUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
          body: JSON.stringify({
            workspaceId,
            userMessage: content,
            sessionId: loadStoredSessionId(profileId) ?? undefined,
            pageContext: "(app)/(home)",
          }),
        });
      } catch (networkErr) {
        // Network failure — revert optimistic update so user can retry
        queryClient.invalidateQueries({ queryKey: ["botsson-messages", targetConversationId] });
        throw networkErr;
      }

      // Status-code passthrough per agent-coord council R1, hop 7:
      // - 401: re-login needed
      // - 403/404/409: stale session_id — clear cache so next turn creates fresh session
      if (!res.ok) {
        if (res.status === 403 || res.status === 404 || res.status === 409) {
          persistSessionId(profileId, null);
        }
        queryClient.invalidateQueries({ queryKey: ["botsson-messages", targetConversationId] });
        const errBody = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errBody.message ?? `Botsson feilet (${res.status})`);
      }

      const data = (await res.json()) as BffChatResponse;
      persistSessionId(profileId, data.sessionId);

      // Write BOTH turns to chat_message AFTER successful BFF round-trip.
      // This avoids the orphan-user-message problem if BFF fails between
      // optimistic render and chat_message insert (per agent-coord hop 6).
      const assistantMessageId = randomUUID();
      const responseTime = new Date().toISOString();

      const { error: insertErr } = await supabase.from("chat_message").insert([
        {
          id: userMessageId,
          conversation_id: targetConversationId,
          content,
          sender_id: profileId,
          is_system: false,
          attachments: [{ type: "botsson_context", ...context }],
          reactions: [],
        },
        {
          id: assistantMessageId,
          conversation_id: targetConversationId,
          content: data.text,
          sender_id: BOTSSON_SENDER_ID,
          is_system: true,
          attachments: data.intent
            ? [{ type: "botsson_intent", capability: data.intent.capability }]
            : [],
          reactions: [],
        },
      ]);

      if (insertErr) {
        // History write failed — the agent turn happened (engine_sessions has
        // the truth) but UI persistence missed. Refetch to reconcile.
        queryClient.invalidateQueries({ queryKey: ["botsson-messages", targetConversationId] });
        throw insertErr;
      }

      // Append the assistant turn into the optimistic cache so UI shows it
      // without waiting for refetch.
      const assistantMessage: BotssonMessage = {
        id: assistantMessageId,
        conversation_id: targetConversationId,
        content: data.text,
        sender_id: BOTSSON_SENDER_ID,
        reply_to_id: null,
        is_system: true,
        attachments: data.intent
          ? [{ type: "botsson_intent", capability: data.intent.capability }]
          : [],
        reactions: [],
        created_at: responseTime,
        updated_at: responseTime,
        edited_at: null,
        deleted_at: null,
        senderName: "Mr. Botsson",
        senderAvatarUrl: null,
      };

      queryClient.setQueryData(
        ["botsson-messages", targetConversationId],
        (old: { pages: BotssonMessage[][]; pageParams: number[] } | undefined) => {
          if (!old) return { pages: [[assistantMessage]], pageParams: [0] };
          const newPages = [...old.pages];
          newPages[0] = [assistantMessage, ...(newPages[0] ?? [])];
          return { ...old, pages: newPages };
        },
      );
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
