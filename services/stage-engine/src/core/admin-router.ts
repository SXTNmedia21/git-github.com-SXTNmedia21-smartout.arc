// ============================================
// admin-router.ts
// Lightweight message pipeline for platform admin (god-mode) conversations.
// Unlike routeAgentMessage(), this does NOT require workspace scope or authority checks.
// Connected to: src/types/agent.ts (AgentChatResponse, ConversationTurn)
// Connected to: src/secrets.ts (OpenRouter API key)
// Tools are NOT included yet — plain LLM conversation only. Tools come in a follow-up task.
// ============================================

import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getSecrets } from "../secrets.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

// Lazy singleton — only initialised once the first message arrives
let _openrouter: ReturnType<typeof createOpenRouter> | null = null;

function getOpenRouter() {
  if (!_openrouter) {
    const apiKey = getSecrets().openrouterApiKey;
    if (!apiKey) {
      throw new Error("OpenRouter API key not available — check Vault or .env.local");
    }
    _openrouter = createOpenRouter({ apiKey });
  }
  return _openrouter;
}

export type AdminRouterInput = {
  message: string;
  sessionId: string;
  /** Optional — admin can scope queries to a specific workspace */
  workspaceId?: string;
  conversationHistory: ConversationTurn[];
};

/**
 * Builds the god-mode system prompt for platform admin conversations.
 * Identifies as Mr. Botsson talking to Pontus (platform admin), with full cross-workspace access.
 * When workspaceId is set, queries are scoped to that workspace.
 * When workspaceId is absent, nudges the admin to use the /workspace command.
 */
function buildAdminSystemPrompt(workspaceId?: string): string {
  const workspaceBlock = workspaceId
    ? `You are currently operating with workspace context: ${workspaceId}. Scope all queries and answers to this workspace.`
    : `No workspace is currently selected. If the question is workspace-specific, suggest the admin use the /workspace <id> command to set context.`;

  return `You are Mr. Botsson, the platform AI assistant for Smartout.
You are in god-mode, talking directly to Pontus — the platform administrator with full cross-workspace visibility.

There are no authority restrictions here. You have access to all workspaces, all data, and all system state.

${workspaceBlock}

Tone and style:
- Direct, concise, no fluff.
- Respond in the same language as the message (Norwegian or English).
- Do not over-explain. Pontus knows the system.
- If something is unclear, ask one clarifying question.

Available commands the admin can use:
- /workspace <id> — set workspace context for subsequent queries
- /done — close this admin session

Do not mention tools or internal implementation details unless directly asked.`.trim();
}

/**
 * Routes a platform admin message through a lightweight LLM pipeline.
 * No workspace scope, no authority checks, no tools — just a god-mode conversation.
 *
 * Steps:
 * 1. Build admin-specific system prompt (with optional workspace context)
 * 2. Build conversation messages from history
 * 3. Call LLM via OpenRouter
 * 4. Return AgentChatResponse
 */
export async function routeAdminMessage(input: AdminRouterInput): Promise<AgentChatResponse> {
  const { message, sessionId, workspaceId, conversationHistory } = input;

  const systemPrompt = buildAdminSystemPrompt(workspaceId);

  // Build full message list: prior history + current user message
  const messages = [
    ...conversationHistory.map((turn) => ({
      role: turn.role as "user" | "assistant",
      content: turn.content,
    })),
    { role: "user" as const, content: message },
  ];

  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4.6"),
    system: systemPrompt,
    messages,
  });

  return {
    session_id: sessionId,
    response: result.text,
  };
}
