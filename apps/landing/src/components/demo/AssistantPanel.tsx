// ============================================
// AssistantPanel.tsx
// Chat panel for the guided demo experience.
// Renders on the right side of the split-screen shell.
// Shows AI assistant messages, typing indicator,
// quick-reply chips, text input, and a voice toggle.
// Connected to: DemoShell.tsx (parent), useDemoJourney.ts (state)
// ============================================

"use client";

import { useEffect, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Bot, Mic, MicOff, Send, Volume2 } from "lucide-react";
import type { QuickReply } from "./journeys/types";

/** A single message in the chat history */
export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  quickReplies?: QuickReply[];
};

type AssistantPanelProps = {
  /** Chat messages to display */
  messages: ChatMessage[];
  /** Whether the assistant is currently "typing" */
  isTyping: boolean;
  /** Whether voice mode is active */
  isVoiceActive: boolean;
  /** Toggle voice mode on/off */
  onToggleVoice: () => void;
  /** Called when user sends a text message */
  onSendMessage: (text: string) => void;
  /** Called when user clicks a quick reply */
  onQuickReply: (reply: QuickReply) => void;
};

/** Animation presets matching landing page design language */
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
};

/**
 * Chat panel with message history, quick replies, and voice toggle.
 *
 * Why a separate panel: Keeps the chat isolated from the feature UI
 * so each feature component doesn't need to know about messaging.
 * The DemoShell orchestrates both sides.
 */
export function AssistantPanel({
  messages,
  isTyping,
  isVoiceActive,
  onToggleVoice,
  onSendMessage,
  onQuickReply,
}: AssistantPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  /**
   * Handles form submission — sends the typed text
   * and clears the input field.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputValue("");
  }

  return (
    <div className="border-border bg-background flex h-full flex-col rounded-2xl border">
      {/* Header — Lise Botsson avatar and name */}
      <div className="border-border flex items-center gap-3 border-b px-4 py-3">
        <div className="bg-brand-orange/20 flex h-9 w-9 items-center justify-center rounded-full">
          <Bot className="text-brand-orange h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-foreground text-sm font-semibold">Lise Botsson</p>
          <p className="text-muted-foreground text-xs">Din AI-assistent</p>
        </div>
        {/* Voice toggle button */}
        <button
          onClick={onToggleVoice}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            isVoiceActive
              ? "bg-brand-orange/20 text-brand-orange"
              : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          }`}
          aria-label={isVoiceActive ? "Slå av stemme" : "Slå på stemme"}
        >
          {isVoiceActive ? <Volume2 className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
      </div>

      {/* Message area — scrollable list of chat bubbles */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <m.div
              key={msg.id}
              {...fadeUp}
              layout
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-foreground/[0.06] text-foreground"
                    : "bg-brand-orange/20 text-brand-orange-light"
                }`}
              >
                {msg.content}
              </div>
            </m.div>
          ))}

          {/* Quick reply chips — shown after the last assistant message */}
          {messages.length > 0 &&
            messages[messages.length - 1]?.role === "assistant" &&
            messages[messages.length - 1]?.quickReplies &&
            messages[messages.length - 1]!.quickReplies!.length > 0 && (
              <m.div key="quick-replies" {...fadeUp} className="flex flex-wrap gap-2 pt-1">
                {messages[messages.length - 1]!.quickReplies!.map((reply) => (
                  <button
                    key={reply.label}
                    onClick={() => onQuickReply(reply)}
                    className="border-brand-orange/30 bg-brand-orange/10 text-brand-orange hover:bg-brand-orange/20 hover:text-brand-orange-light rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors"
                  >
                    {reply.label}
                  </button>
                ))}
              </m.div>
            )}
        </AnimatePresence>

        {/* Typing indicator — three bouncing dots */}
        <AnimatePresence>
          {isTyping && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1 px-1"
            >
              {[0, 1, 2].map((i) => (
                <m.span
                  key={i}
                  className="bg-muted-foreground h-1.5 w-1.5 rounded-full"
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area — text field + send button */}
      <form
        onSubmit={handleSubmit}
        className="border-border flex items-center gap-2 border-t px-3 py-3"
      >
        {/* Voice mode indicator */}
        {isVoiceActive && (
          <button
            type="button"
            onClick={onToggleVoice}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30"
            aria-label="Stopp stemmeinnspilling"
          >
            <MicOff className="h-4 w-4" />
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isVoiceActive ? "Lytter..." : "Skriv en melding..."}
          disabled={isVoiceActive}
          className="border-border bg-foreground/[0.03] text-foreground placeholder:text-muted-foreground focus:border-brand-orange/30 flex-1 rounded-xl border px-3.5 py-2 text-sm focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputValue.trim() || isVoiceActive}
          className="bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 disabled:hover:bg-brand-orange/20 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-30"
          aria-label="Send melding"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
