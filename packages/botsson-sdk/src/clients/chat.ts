// chat.ts — Thin chat client for the Smartout stage-engine via the BFF.
//
// Wraps POST /api/emma/chat (already exists — no new BFF route needed).
// The BFF enforces channel="chat" server-side per ADR-0078; we don't
// expose a channel param to callers.
//
// This module is framework-agnostic (no React) so it can be used in
// server utilities or outside component trees if needed.

import type { ChatReply } from "../types";

// ---------------------------------------------------------------------------
// Request shape accepted by the chat client
// ---------------------------------------------------------------------------

export type AskSmartoutParams = {
  /** Workspace to route the request to */
  workspaceId: string;
  /** User's natural language message */
  message: string;
  /**
   * Session ID from a prior reply — threads the conversation on stage-engine.
   * Omit on the first turn; reuse on subsequent turns.
   */
  sessionId?: string;
  /**
   * Current page path, e.g. "/dashboard/schedule".
   * Stage-engine uses this to bias intent classification.
   */
  pageContext?: string;
  /** Optional mission context (e.g. "contract_intake") */
  mission?: string;
  missionContext?: Record<string, unknown>;
  /** Abort signal — caller can cancel in-flight requests */
  signal?: AbortSignal;
};

// ---------------------------------------------------------------------------
// Response shape from /api/emma/chat
// ---------------------------------------------------------------------------

type BffChatResponse = {
  text?: string;
  sessionId?: string;
  intent?: { capability: string; confidence: number };
  error?: string;
  message?: string;
};

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export type ChatClientConfig = {
  /**
   * BFF endpoint. Default: "/api/emma/chat"
   * Must be a Next.js route that proxies to stage-engine.
   */
  endpoint?: string;
};

/**
 * Create a chat client bound to a specific BFF endpoint.
 *
 * @example
 * ```ts
 * const chat = createChatClient();
 * const reply = await chat.askSmartout({ workspaceId, message: "hva er mine vakter?" });
 * console.log(reply.text);
 * ```
 */
export function createChatClient(config: ChatClientConfig = {}) {
  const endpoint = config.endpoint ?? "/api/emma/chat";

  /**
   * Send a message to Smartout and return the reply.
   * Throws on network/BFF errors.
   */
  async function askSmartout(params: AskSmartoutParams): Promise<ChatReply> {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        workspaceId: params.workspaceId,
        userMessage: params.message,
        sessionId: params.sessionId,
        pageContext: params.pageContext,
        mission: params.mission,
        missionContext: params.missionContext,
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as BffChatResponse;
      throw new Error(errBody.error ?? errBody.message ?? `Chat request failed: ${res.status}`);
    }

    const data = (await res.json()) as BffChatResponse;

    if (!data.text) {
      throw new Error("Chat response missing text field");
    }

    return {
      text: data.text,
      sessionId: data.sessionId ?? "",
      intent: data.intent,
    };
  }

  return { askSmartout };
}

/** Default singleton — use this unless you need a custom endpoint */
export const chatClient = createChatClient();
