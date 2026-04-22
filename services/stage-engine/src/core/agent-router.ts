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
import type { AuthorityLevel } from "@smartout/ai/capabilities/types";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { AgentContext } from "@smartout/ai/context/types";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { loadOnboardingContext } from "./session-manager.js";
import { getRecorder } from "./session-recorder.js";
import { GateActionFailed, SchemaCacheStale } from "../lib/errors.js";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { broadcastToSession } from "../ws/connection-manager.js";
import { getBufferedActions } from "../routes/ws.js";
import type { MissionProtocolMessage } from "@smartout/types";
import { getSecrets } from "../secrets.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";

/**
 * Row shape returned by the classifier-context profile query.
 * Supabase returns the FK-joined department as either a nullable row object
 * or (for typed-client quirks) an array — we narrow via isNameRow().
 */
type ClassifierProfileRow = {
  role: string | null;
  display_name: string | null;
  department: unknown;
};

function isNameRow(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

/**
 * Builds a compact (1–2 line) textual context for the intent classifier.
 *
 * ADR-0112 (Intent Classifier Coverage) requires the classifier to disambiguate
 * e.g. "når jobber jeg?" (employee read) from manager/admin shift queries. The
 * classifier receives `context` as free-form text injected into its prompt
 * (see packages/ai/src/router/intent-classifier.ts `prompt:`). We therefore
 * describe role + department in a form the LLM can weigh against the
 * incoming message.
 *
 * Scope note: team membership is intentionally omitted. `profile` has no
 * `team_id` column (team membership lives in the `team_member` junction table),
 * and adding a second query for a classifier-signal of marginal value is not
 * worth the latency. Role + department already resolves the manager/employee
 * disambiguation that ADR-0112 targets.
 *
 * Workspace isolation: only profile_id + workspace_id are used; no cross-tenant
 * data is exposed. A failed lookup yields an empty string — classifier falls
 * back to message-only reasoning (previous behaviour).
 */
export async function buildClassifierContext(params: {
  supabase: SupabaseClient;
  workspaceId: string;
  profileId: string;
}): Promise<string> {
  const { supabase, workspaceId, profileId } = params;

  const { data } = await supabase
    .from("profile")
    .select("role, display_name, department:department_id(name)")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) return "";

  const row = data as unknown as ClassifierProfileRow;
  const role = row.role ?? "employee";
  const department = isNameRow(row.department) ? row.department.name : null;

  const parts: string[] = [`Rolle: ${role}.`];
  if (department) parts.push(`Avdeling: ${department}.`);

  return parts.join(" ");
}

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
  // ADR-0112: feed role/department/team into classifier context so it can
  // disambiguate e.g. "når jobber jeg?" (employee read) vs manager queries.
  // Phase A5 — previously `""` discarded this signal.
  const classifierContext = await buildClassifierContext({
    supabase: supabaseAdmin,
    workspaceId,
    profileId,
  });

  // ADR-0184 — record classifier_input BEFORE and classifier_output AFTER
  // classifyIntent(). Recorder is optional (getRecorder() returns null when no
  // singleton has been set) and fire-and-forget by contract.
  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "user_input",
      phase: "classifier_input",
      content: { message, classifierContext },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  const intent = await classifyIntent(message, classifierContext, {
    apiKey: getSecrets().openrouterApiKey ?? undefined,
  });

  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "user_input",
      phase: "classifier_output",
      content: {
        intent: intent.capability,
        confidence: intent.confidence,
      },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

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
    if (gateError.code === "PGRST002" || /schema cache/i.test(gateError.message)) {
      throw new SchemaCacheStale(`gate_action: ${gateError.message}`, {
        capability: intent.capability,
        workspaceId,
      });
    }
    throw new GateActionFailed(`gate_action RPC failed: ${gateError.message}`, {
      capability: intent.capability,
      workspaceId,
    });
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

  // Authority for the matched capability = what gate_action decided.
  // The advisory authority map is no longer re-derived post-gate (Council 2026-04-16).
  const authority = (gate.downgrade_to ??
    rawAuthority.levels[intent.capability] ??
    "read_only") as AuthorityLevel;
  const authorityConfig: Record<string, AuthorityLevel> = {
    ...rawAuthority.levels,
    [intent.capability]: authority,
  };

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

  // ADR-0184 — record llm_request BEFORE and llm_response AFTER generateText
  // with latency_ms in meta for replay / debug. Model string is recorded at
  // request-time so an LLM rotation mid-turn is visible in the trace.
  const llmModel = "anthropic/claude-sonnet-4.6";
  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "agent_response",
      phase: "llm_request",
      content: {
        systemPrompt: finalSystemPrompt,
        messages,
        toolCount: selectedTools.length,
      },
      meta: { model: llmModel },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  const llmStart = Date.now();
  const result = await generateText({
    model: getOpenRouter()(llmModel),
    system: finalSystemPrompt,
    messages,
    tools: vercelTools,
    stopWhen: stepCountIs(5),
  });
  const llmLatencyMs = Date.now() - llmStart;

  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "agent_response",
      phase: "llm_response",
      content: {
        text: result.text,
      },
      meta: { model: llmModel, latency_ms: llmLatencyMs },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

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
