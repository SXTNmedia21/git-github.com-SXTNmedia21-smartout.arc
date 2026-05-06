"use client";

/**
 * ChatPanel — Slide-over chat panel triggered from notification clicks.
 *
 * Reuses MessageTimeline and MessageInput from the komm module.
 * Opens as a right-side panel over any dashboard page, so the user
 * can reply without navigating away.
 */

import { useContext, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { X, Hash, MessageCircle, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "./DashboardShell";
import { MessageTimeline } from "@/app/dashboard/komm/_components/MessageTimeline";
import { MessageInput } from "@/app/dashboard/komm/_components/MessageInput";
import { useTranslation } from "@smartout/i18n";

/* ------------------------------------------------------------------ */
/*  Channel name resolver                                              */
/* ------------------------------------------------------------------ */

function useChannelInfo(channelId: string | null) {
  return useQuery({
    queryKey: ["channel-info", channelId],
    enabled: !!channelId,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("channel")
        .select("id, name, channel_type, is_read_only")
        .eq("id", channelId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Panel spring config (Nordic Split)                                 */
/* ------------------------------------------------------------------ */

const PANEL_SPRING = { type: "spring" as const, ...motionTokens.spring };

/* ------------------------------------------------------------------ */
/*  Context for opening the panel from anywhere                        */
/* ------------------------------------------------------------------ */

import { createContext } from "react";

type ChatPanelContextType = {
  openChat: (channelId: string) => void;
  closeChat: () => void;
  activeChannelId: string | null;
};

export const ChatPanelContext = createContext<ChatPanelContextType>({
  openChat: () => {},
  closeChat: () => {},
  activeChannelId: null,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);

  const openChat = useCallback((channelId: string) => {
    setActiveChannelId(channelId);
  }, []);

  const closeChat = useCallback(() => {
    setActiveChannelId(null);
  }, []);

  return (
    <ChatPanelContext value={{ openChat, closeChat, activeChannelId }}>
      {children}
      <ChatPanelOverlay channelId={activeChannelId} onClose={closeChat} />
    </ChatPanelContext>
  );
}

/* ------------------------------------------------------------------ */
/*  Overlay panel                                                      */
/* ------------------------------------------------------------------ */

function ChatPanelOverlay({
  channelId,
  onClose,
}: {
  channelId: string | null;
  onClose: () => void;
}) {
  const { profileId } = useContext(DashboardContext);
  const { data: channel } = useChannelInfo(channelId);
  const { t: _t } = useTranslation("notifications");
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const isOpen = !!channelId;
  const isDirect = channel?.channel_type === "direct";
  const ChannelIcon = isDirect ? MessageCircle : Hash;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: motionTokens.exitMs / 1000 }
            }
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="chat-panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={PANEL_SPRING}
            className="bg-card border-border fixed top-0 right-0 z-50 flex h-full w-[420px] max-w-[90vw] flex-col border-l shadow-2xl"
          >
            {/* Header */}
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <ChannelIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-foreground truncate text-sm font-semibold">
                  {channel?.name ?? "..."}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/dashboard/komm`);
                    onClose();
                  }}
                  className="hover:bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                  aria-label="Open in full view"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="hover:bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                  aria-label="Close chat panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              {channelId && profileId && (
                <MessageTimeline
                  channelId={channelId}
                  profileId={profileId}
                  onReply={setReplyToId}
                />
              )}
            </div>

            {/* Input */}
            {channelId && profileId && !channel?.is_read_only && (
              <MessageInput
                channelId={channelId}
                profileId={profileId}
                replyToId={replyToId}
                onCancelReply={() => setReplyToId(null)}
                audioPolicy={undefined}
                pttProps={undefined}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
