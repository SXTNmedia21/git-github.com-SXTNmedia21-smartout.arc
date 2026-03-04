"use client";

import { useState, useCallback, useRef } from "react";
import type { TranscriptEntry, AgentStatus } from "../types";

/**
 * Configuration for the chat-based agent hook.
 */
export type AgentChatConfig = {
  /** API endpoint for chat messages */
  apiEndpoint?: string;
  /** Extra headers to send with each request */
  headers?: Record<string, string>;
  /** Called when the agent responds */
  onResponse?: (text: string) => void;
};

/**
 * Return type of useAgentChat.
 */
export type AgentChatSession = {
  status: AgentStatus;
  messages: TranscriptEntry[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<string>;
  clearMessages: () => void;
};

/**
 * Chat-based agent hook for text interactions.
 * Sends messages to an API endpoint and collects responses.
 *
 * This is a lighter alternative to useAgent for text-only interfaces
 * where voice is not needed.
 */
export function useAgentChat(config: AgentChatConfig = {}): AgentChatSession {
  const { apiEndpoint = "/api/agent/chat", headers, onResponse } = config;

  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string): Promise<string> => {
      // Cancel any pending request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Add user message
      setMessages((prev) => [...prev, { role: "user", text }]);
      setIsLoading(true);

      try {
        const res = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: JSON.stringify({ message: text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errorData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorData.error ?? `Request failed: ${res.status}`);
        }

        const data = (await res.json()) as { response?: string };
        const response = data.response ?? "";

        // Add agent response
        setMessages((prev) => [...prev, { role: "agent", text: response }]);
        onResponse?.(response);

        return response;
      } finally {
        setIsLoading(false);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [apiEndpoint, headers, onResponse],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const status: AgentStatus = isLoading ? "thinking" : "idle";

  return {
    status,
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
