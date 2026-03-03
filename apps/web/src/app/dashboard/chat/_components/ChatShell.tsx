"use client";

import { useState, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { useConversations } from "../_hooks/use-conversations";
import { useMessages, useSendMessage } from "../_hooks/use-messages";
import { useToggleReaction } from "../_hooks/use-reactions";
import { useMarkAsRead } from "../_hooks/use-mark-as-read";
import { useChatRealtime } from "../_hooks/use-chat-realtime";
import { useCreateConversation } from "../_hooks/use-create-conversation";
import { ConversationList } from "./ConversationList";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { MemberPanel } from "./MemberPanel";
import { CreateConversation } from "./CreateConversation";
import type { MessageWithSender } from "../_hooks/chat-types";

type Props = {
  profileId: string;
};

export function ChatShell({ profileId }: Props) {
  // ── State ────────────────────────────────────────────────
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [replyTo, setReplyTo] = useState<{
    id: string;
    senderName: string;
  } | null>(null);

  // ── Hooks ────────────────────────────────────────────────
  const conversations = useConversations();
  const messages = useMessages(activeConversationId);
  const sendMessage = useSendMessage(activeConversationId, profileId);
  const toggleReaction = useToggleReaction(activeConversationId);
  const markAsRead = useMarkAsRead();
  const createConversation = useCreateConversation();

  // Realtime subscription for active conversation
  useChatRealtime(activeConversationId);

  // ── Derived ──────────────────────────────────────────────
  const activeConversation = useMemo(
    () => conversations.data?.find((c) => c.id === activeConversationId) ?? null,
    [conversations.data, activeConversationId],
  );

  // ── Handlers ─────────────────────────────────────────────
  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversationId(id);
      setReplyTo(null);
      setShowMembers(false);
      markAsRead.mutate({ conversationId: id, profileId });
    },
    [profileId, markAsRead],
  );

  const handleSend = useCallback(
    (content: string, replyToId?: string) => {
      sendMessage.mutate({ content, replyToId });
    },
    [sendMessage],
  );

  const handleReply = useCallback(
    (messageId: string) => {
      const allMessages = messages.data?.pages.flat() ?? [];
      const msg = allMessages.find((m: MessageWithSender) => m.id === messageId);
      if (msg) {
        setReplyTo({
          id: msg.id,
          senderName: msg.sender.display_name ?? "Ukjent",
        });
      }
    },
    [messages.data],
  );

  const handleReaction = useCallback(
    (messageId: string, emoji: string) => {
      toggleReaction.mutate({ messageId, emoji, profileId });
    },
    [toggleReaction, profileId],
  );

  const handleCreate = useCallback(
    (data: {
      type: "group" | "dm" | "ai";
      name?: string;
      description?: string;
      participantIds: string[];
    }) => {
      createConversation.mutate(
        {
          ...data,
          createdBy: profileId,
        },
        {
          onSuccess: (conv) => {
            setShowCreate(false);
            setActiveConversationId(conv.id);
          },
        },
      );
    },
    [createConversation, profileId],
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="border-border bg-background flex h-full overflow-hidden rounded-lg border">
      {/* Left: Conversation list */}
      <ConversationList
        conversations={conversations.data ?? []}
        activeId={activeConversationId}
        onSelect={handleSelectConversation}
        onCreateNew={() => setShowCreate(true)}
        isLoading={conversations.isLoading}
      />

      {/* Center: Active conversation */}
      <div className="flex flex-1 flex-col">
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              onToggleMembers={() => setShowMembers((s) => !s)}
            />
            <MessageList
              pages={messages.data?.pages ?? []}
              profileId={profileId}
              hasNextPage={!!messages.hasNextPage}
              isFetchingNextPage={messages.isFetchingNextPage}
              fetchNextPage={() => messages.fetchNextPage()}
              onReply={handleReply}
              onReaction={handleReaction}
            />
            <MessageInput
              conversationName={activeConversation.name ?? "samtalen"}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onSend={handleSend}
              isSending={sendMessage.isPending}
            />
          </>
        ) : (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Velg en samtale for a starte</p>
          </div>
        )}
      </div>

      {/* Right: Member panel */}
      <AnimatePresence>
        {showMembers && activeConversation && (
          <MemberPanel conversation={activeConversation} onClose={() => setShowMembers(false)} />
        )}
      </AnimatePresence>

      {/* Create conversation dialog */}
      <CreateConversation
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
        isCreating={createConversation.isPending}
      />
    </div>
  );
}
