// ============================================
// agent.ts
// Type definitions for agent mode conversations.
// Used by the agent router, agent session manager, and chat route.
// Connected to: src/types/session.ts (SessionMode = "agent")
// Connected to: src/core/agent-router.ts (processes messages)
// ============================================

/** Botsson context pipe blocks (all optional — graceful degradation). */
type UserContextBlock = {
  profile_id: string;
  role: "owner" | "admin" | "manager" | "employee";
  status: "trainee" | "active" | "inactive" | "offboarding";
  department_id: string | null;
  display_name: string;
  language: "no" | "en" | "sv" | "da" | "fi";
};

type WorkspaceContextBlock = {
  workspace_id: string;
  name: string;
  niche: string | null;
  active_season_id: string | null;
  active_framework_id: string | null;
  planning_cycle_id: string | null;
};

type RouteContextBlock = {
  path: string;
  query: Record<string, string>;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
};

/** Request body for POST /agent/chat */
export type AgentChatRequest = {
  message: string;
  session_id?: string;
  profile_id: string;
  channel?: "chat" | "voice" | "telegram";
  user_context?: UserContextBlock;
  workspace_context?: WorkspaceContextBlock;
  route_context?: RouteContextBlock;
};

/** Response from the agent chat endpoint */
export type AgentChatResponse = {
  session_id: string;
  response: string;
  intent?: {
    capability: string;
    confidence: number;
  };
  /**
   * ADR-0327 Phase 3.5 — client-tool roundtrip protocol.
   *
   * Present when the LLM picked one or more CLIENT-shipped tools during the
   * turn. Stage-engine pauses after detecting these calls and returns them
   * here so the BFF/browser can execute them and send back results via
   * `client_tool_results` in the next request.
   *
   * When absent (undefined), no client tools were invoked — normal turn.
   */
  client_tool_calls?: import("@smartout/ai/harness/types").ClientToolCall[];
};

/** A single turn in a conversation (stored in session collected_data) */
export type ConversationTurn = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};
