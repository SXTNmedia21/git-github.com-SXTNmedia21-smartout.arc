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
import { applyMinRoleDowngrade } from "@smartout/ai/router/min-role";
import type { AuthorityLevel, ProfileRole } from "@smartout/ai/capabilities/types";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { AgentContext } from "@smartout/ai/context/types";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { loadOnboardingContext } from "./session-manager.js";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import { broadcastToSession } from "../ws/connection-manager.js";
import { getBufferedActions } from "../routes/ws.js";
import type { MissionProtocolMessage } from "@smartout/types";
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
  pageContext?: string; // current page pathname from frontend (e.g. "/dashboard/schedule")
  channel?: "chat" | "voice"; // ADR-0078: propagated to toolContext for PII defense
  userJwt?: string; // Employee JWT for user-scoped PII writes (contract intake)
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
    pageContext,
    channel,
    userJwt,
  } = input;

  // Step 1: Load authority config (advisory map used for tool selection only; the authoritative
  // per-call decision is the public.gate_action RPC invoked after intent is known — ADR-0099).
  const rawAuthority = await loadAuthorityConfig(workspaceId);

  // Step 2: Classify intent
  const intent = await classifyIntent(message, "", {
    apiKey: getSecrets().openrouterApiKey ?? undefined,
  });

  // Step 2b: Unified authority gate (ADR-0099). Replaces inline min-role + channel logic.
  // Gate returns { allow, downgrade_to, reason, gate_evaluation_id } and writes a gate_evaluation audit row.
  const { data: gateResult, error: gateError } = await supabaseAdmin.rpc("gate_action", {
    p_workspace_id: workspaceId,
    p_capability: intent.capability,
    p_channel: channel ?? "chat",
    p_actor_profile_id: profileId,
    p_action_type: "agent_chat",
  });
  if (gateError) {
    throw new Error(`gate_action RPC failed: ${gateError.message}`);
  }
  const gate = gateResult as {
    allow: boolean;
    downgrade_to: string | null;
    reason: string | null;
    gate_evaluation_id: string;
  };
  if (!gate.allow) {
    return {
      session_id: sessionId,
      response:
        gate.reason === "channel_not_permitted"
          ? "Dette kan jeg ikke gjøre på denne kanalen. Prøv via chat i dashbordet."
          : "Dette er ikke tillatt for din rolle akkurat nå.",
      intent: { capability: intent.capability, confidence: intent.confidence },
    };
  }

  // Tool selection still needs per-capability authority for filtering;
  // apply min-role downgrade on the advisory map for the caller's role.
  const { data: profileRow } = await supabaseAdmin
    .from("profile")
    .select("role")
    .eq("id", profileId)
    .maybeSingle<{ role: ProfileRole }>();
  const callerRole: ProfileRole = profileRow?.role ?? "employee";
  const authorityConfig = applyMinRoleDowngrade(
    rawAuthority.levels,
    rawAuthority.minRoles,
    callerRole,
  );
  // Honour RPC downgrade verdict for the matched capability.
  if (gate.downgrade_to) {
    authorityConfig[intent.capability] = gate.downgrade_to as AuthorityLevel;
  }

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
  const authority = authorityConfig[intent.capability] ?? "read_only";

  // Step 3: Collect full context (parallel fetch)
  const ctx = await collectContext({
    workspaceId,
    profileId,
    situation: resolvedSituation,
    authority,
    supabaseAdmin,
  });

  // Step 3b: Inject prior onboarding context (Lise → Botsson handoff)
  const onboardingCtx = await loadOnboardingContext(profileId, workspaceId);
  if (onboardingCtx) {
    ctx.priorOnboarding = onboardingCtx.prior_onboarding as AgentContext["priorOnboarding"];
  }

  // Step 4: Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig, channel);

  // Step 5: Build posture-aware system prompt
  const systemPrompt = buildBotssonPromptFromContext(
    ctx,
    selectedTools.map((t) => `${t.name}: ${t.description}`),
  );

  // Inject page context into system prompt so Emma knows where the user is
  let finalSystemPrompt = systemPrompt;
  if (pageContext) {
    finalSystemPrompt += `\n\n## Brukerens skjerm\nBrukeren er pa: ${pageContext}`;
  }

  // Inject buffered user actions from WebSocket into the message
  const bufferedActions = getBufferedActions(sessionId);
  let augmentedMessage = message;
  if (bufferedActions.length > 0) {
    const actionSummary = bufferedActions.map((a) => JSON.stringify(a.action)).join(", ");
    augmentedMessage = `[UI events since last turn: ${actionSummary}]\n\n${message}`;
  }

  // Context window: send last 5 turns verbatim, pointer for older history
  const CONTEXT_WINDOW = 5;
  const recentHistory =
    conversationHistory.length > CONTEXT_WINDOW
      ? conversationHistory.slice(-CONTEXT_WINDOW)
      : conversationHistory;

  if (conversationHistory.length > CONTEXT_WINDOW) {
    finalSystemPrompt += `\n\n## Samtalehistorikk\nDe ${conversationHistory.length - CONTEXT_WINDOW} eldste meldingene er utelatt. Du husker de siste ${CONTEXT_WINDOW} meldingene.`;
  }

  // Build conversation messages for the LLM
  const messages = recentHistory.map((turn) => ({
    role: turn.role as "user" | "assistant",
    content: turn.content,
  }));
  messages.push({ role: "user", content: augmentedMessage });

  // Step 6: Run LLM with tools
  // Create user-scoped client when JWT is provided (needed for PII writes via submit_own_pii)
  const supabaseUser = userJwt ? createUserClient(userJwt) : undefined;

  const toolContext = {
    workspaceId,
    profileId,
    userId,
    sessionId,
    channel,
    supabaseAdmin,
    supabaseUser,
    broadcast: (event: unknown) => broadcastToSession(sessionId, event as MissionProtocolMessage),
  };

  const vercelTools = toVercelTools(selectedTools, toolContext);

  const result = await generateText({
    model: getOpenRouter()("anthropic/claude-sonnet-4.6"),
    system: finalSystemPrompt,
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
