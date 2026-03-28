// ============================================
// agent.ts
// Type definitions for agent mode conversations.
// Used by the agent router, agent session manager, and chat route.
// Connected to: src/types/session.ts (SessionMode = "agent")
// Connected to: src/core/agent-router.ts (processes messages)
// ============================================

/** Request body for POST /agent/chat */
export type AgentChatRequest = {
  message: string;
  session_id?: string;
  profile_id: string;
  channel?: "chat" | "voice" | "telegram";
};

/** Response from the agent chat endpoint */
export type AgentChatResponse = {
  session_id: string;
  response: string;
  intent?: {
    capability: string;
    confidence: number;
  };
};

/** A single turn in a conversation (stored in session collected_data) */
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};
