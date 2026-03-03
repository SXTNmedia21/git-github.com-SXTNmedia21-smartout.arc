// ============================================
// agent-router.ts
// Core routing logic for agent mode conversations.
// Pipeline: classify intent → load authority → collect context → select tools → build prompt → LLM
// Connected to: @smartout/ai (intent-classifier, tool-selector, mr-botsson, context, vercel-ai)
// Connected to: src/core/authority.ts (workspace authority config)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { classifyIntent } from "@smartout/ai/router/intent-classifier";
import { selectTools } from "@smartout/ai/router/tool-selector";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getSecrets } from "../secrets.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

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

type AgentRouterInput = {
  message: string;
  sessionId: string;
  workspaceId: string;
  profileId: string;
  userId?: string;
  conversationHistory: ConversationTurn[];
  situation?: Situation;
};

/**
 * Routes an agent message through the full pipeline:
 * 1. Load authority config
 * 2. Classify intent
 * 3. Collect full context (profile, agent profile, relationship, memories, shift)
 * 4. Select tools based on intent + authority
 * 5. Build posture-aware system prompt
 * 6. Run LLM with tools
 */
export async function routeAgentMessage(input: AgentRouterInput): Promise<AgentChatResponse> {
  const {
    message,
    sessionId,
    workspaceId,
    profileId,
    userId,
    conversationHistory,
    situation = "general",
  } = input;

  // Step 1: Load authority config
  const authorityConfig = await loadAuthorityConfig(workspaceId);

  // Step 2: Classify intent
  const intent = await classifyIntent(message, "", {
    apiKey: getSecrets().openrouterApiKey ?? undefined,
  });

  // Determine situation from intent if not explicitly provided
  const resolvedSituation: Situation =
    situation !== "general"
      ? situation
      : intent.capability === "schedule"
        ? "scheduling"
        : intent.capability === "training"
          ? "training"
          : intent.capability === "operations"
            ? "operations"
            : "general";

  // Determine authority for the matched capability
  const authority = authorityConfig[intent.capability] ?? "suggest";

  // Step 3: Collect full context (parallel fetch)
  const ctx = await collectContext({
    workspaceId,
    profileId,
    situation: resolvedSituation,
    authority,
    supabaseAdmin,
  });

  // Step 4: Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig);

  // Step 5: Build posture-aware system prompt
  const systemPrompt = buildBotssonPromptFromContext(
    ctx,
    selectedTools.map((t) => `${t.name}: ${t.description}`),
  );

  // Build conversation messages for the LLM
  const messages = conversationHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: message });

  // Step 6: Run LLM with tools
  const toolContext = {
    workspaceId,
    profileId,
    userId,
    sessionId,
    supabaseAdmin,
  };

  const vercelTools = toVercelTools(selectedTools, toolContext);

  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4"),
    system: systemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(5),
  });

  // Step 7: Return response
  return {
    session_id: sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };
}
