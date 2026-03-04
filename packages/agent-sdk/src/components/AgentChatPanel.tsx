"use client";

import { useState, useRef, useEffect } from "react";
import type { TranscriptEntry } from "../types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type AgentChatPanelProps = {
  /** Displayed messages */
  messages: TranscriptEntry[];
  /** Whether the agent is currently processing a message */
  isLoading: boolean;
  /** Called when the user submits a message */
  onSendMessage: (text: string) => void;
  /** Agent display name */
  agentName?: string;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Called when the user closes the panel */
  onClose?: () => void;
};

/**
 * Minimal chat panel component for text-based agent interactions.
 *
 * Uses CSS variable classes for theming — integrates with the app's
 * design system via `bg-background`, `text-foreground`, etc.
 */
export function AgentChatPanel({
  messages,
  isLoading,
  onSendMessage,
  agentName = "Agent",
  placeholder = "Skriv en melding...",
  onClose,
}: AgentChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    onSendMessage(text);
  };

  return (
    <div
      className="border-border bg-background"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: "1rem",
        border: "1px solid",
        overflow: "hidden",
        height: "100%",
        maxHeight: "600px",
        width: "350px",
      }}
    >
      {/* Header */}
      <div
        className="border-border/60 bg-muted/50"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem",
          borderBottom: "1px solid",
        }}
      >
        <div>
          <h3 className="text-foreground" style={{ fontSize: "0.875rem", fontWeight: 700 }}>
            {agentName}
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
            style={{
              padding: "0.5rem",
              borderRadius: "0.5rem",
              transition: "all 0.15s",
              cursor: "pointer",
              border: "none",
              background: "none",
            }}
            aria-label="Close chat"
          >
            X
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {messages.length === 0 ? (
          <div
            className="text-muted-foreground"
            style={{
              display: "flex",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: "0.875rem",
            }}
          >
            Send en melding for å starte
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <span
                className="text-muted-foreground"
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "0.25rem",
                }}
              >
                {msg.role === "user" ? "Du" : agentName}
              </span>
              <div
                className={
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground border-border/50"
                }
                style={{
                  maxWidth: "85%",
                  borderRadius: "1rem",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  borderBottomRightRadius: msg.role === "user" ? "0" : undefined,
                  borderBottomLeftRadius: msg.role === "agent" ? "0" : undefined,
                  border: msg.role === "agent" ? "1px solid" : undefined,
                }}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div
            className="text-muted-foreground"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            <span style={{ animation: "agentSdkDots 1.5s infinite" }}>...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-border bg-muted/50"
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "1rem",
          borderTop: "1px solid",
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="bg-background text-foreground border-border placeholder:text-muted-foreground"
          style={{
            flex: 1,
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid",
            fontSize: "0.875rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
            border: "none",
            transition: "all 0.15s",
          }}
        >
          Send
        </button>
      </form>

      <style>{`
        @keyframes agentSdkDots {
          0% { opacity: 0.2; }
          50% { opacity: 1; }
          100% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
