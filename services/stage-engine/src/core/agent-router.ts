// ============================================
// agent-router.ts
// Core routing logic for agent mode conversations.
// Pipeline: classify intent → load authority → collect context → select tools → build prompt → LLM
// Connected to: @smartout/ai (intent-classifier, tool-selector, mr-botsson, context, vercel-ai)
// Connected to: src/core/authority.ts (workspace authority config)
// ============================================

import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { NonEmptyString } from "@smartout/telemetry/server";
import { classifyIntent } from "@smartout/ai/router/intent-classifier";
import type { ClassifierContext } from "@smartout/ai/router/intent-classifier";
import { selectTools } from "@smartout/ai/router/tool-selector";
import type {
  AuthorityLevel,
  ProfileRole,
  SessionChannel,
  UserContext,
  WorkspaceContext,
  RouteContext,
} from "@smartout/ai/capabilities/types";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { AgentContext } from "@smartout/ai/context/types";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { loadOnboardingContext } from "./session-manager.js";
import { fetchActiveStateSummary } from "./mission-summary.js";
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
 * Builds a structured classifier context from the speaker's profile row.
 *
 * ADR-0112 (Intent Classifier Coverage) requires the classifier to disambiguate
 * e.g. "når jobber jeg?" (employee read) from manager/admin shift queries. The
 * classifier receives `ClassifierContext` (role + department + channel +
 * workspaceId), serialized internally before the prompt call. We therefore
 * hand back an explicit object here — each field honest about `null` — rather
 * than a free-form string (which makes it too easy to silently pass `""`).
 *
 * Scope note: team membership is intentionally omitted. `profile` has no
 * `team_id` column (team membership lives in the `team_member` junction table),
 * and adding a second query for a classifier-signal of marginal value is not
 * worth the latency. Role + department already resolves the manager/employee
 * disambiguation that ADR-0112 targets.
 *
 * Workspace isolation: only profile_id + workspace_id are used; no cross-tenant
 * data is exposed. When the profile lookup finds no row, we return an object
 * with `role=null` + `departmentName=null` (the remaining fields come from the
 * caller). The classifier then falls back to message-only reasoning for those
 * axes — the previous "return empty string" behaviour was silent corruption
 * (L-0094 phantom contract) and is explicitly banned by ADR-0193.
 */
export async function buildClassifierContext(params: {
  supabase: SupabaseClient;
  workspaceId: NonEmptyString;
  profileId: NonEmptyString;
  channel: SessionChannel | null;
}): Promise<ClassifierContext> {
  const { supabase, workspaceId, profileId, channel } = params;

  const { data } = await supabase
    .from("profile")
    .select("role, display_name, department:department_id(name)")
    .eq("profile_id", profileId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data) {
    return {
      role: null,
      departmentName: null,
      workspaceId,
      channel,
    };
  }

  const row = data as unknown as ClassifierProfileRow;
  const role = (row.role ?? null) as ProfileRole | null;
  const departmentName = isNameRow(row.department) ? row.department.name : null;

  return {
    role,
    departmentName,
    workspaceId,
    channel,
  };
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
  // ADR-0193 scope amendment (2026-04-23): branded to propagate AgentToolContext
  // invariants through to capability tools. Callers brand at the boundary
  // (chat.ts after workspace guard; sessions.ts via deriveProfileId).
  workspaceId: NonEmptyString;
  profileId: NonEmptyString;
  userId?: string;
  conversationHistory: ConversationTurn[];
  situation?: Situation;
  pageContext?: string; // current page pathname from frontend (e.g. "/dashboard/schedule")
  channel?: "chat" | "voice"; // ADR-0078: propagated to toolContext for PII defense
  userJwt?: string; // Employee JWT for user-scoped PII writes (contract intake)
  /** ADR-0239: wizard_session_id when journey-authoring wizard is the caller. */
  wizardSessionId?: string;
  /** Botsson context pipe: who is speaking (from GET /api/botsson/voice/session-context). */
  userContext?: UserContext;
  /** Botsson context pipe: workspace cascade state (season, framework, planning cycle). */
  workspaceContext?: WorkspaceContext;
  /** Botsson context pipe: current page + focused entity published by the browser. */
  routeContext?: RouteContext;
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
    wizardSessionId,
    userContext,
    workspaceContext,
    routeContext,
  } = input;

  // Step 1: Load authority config (advisory map used for tool selection only; the authoritative
  // per-call decision is the public.gate_action RPC invoked after intent is known — ADR-0099).
  const rawAuthority = await loadAuthorityConfig(workspaceId);

  // ADR-0184 — record authority_load. Captures the advisory levels map so a
  // replay can show what tool-selection saw BEFORE gate_action made the
  // authoritative decision. Fire-and-forget: a recorder failure is silent.
  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "agent_response",
      phase: "authority_load",
      content: {
        levels: rawAuthority.levels,
        capability_count: Object.keys(rawAuthority.levels).length,
      },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  // Step 2: Classify intent
  // ADR-0112 + Phase A5: feed role/department/channel into classifier context
  // so it can disambiguate e.g. "når jobber jeg?" (employee read) vs manager
  // queries. The context is a typed object — previously `""` silently
  // discarded the signal (L-0094 phantom contract).
  const classifierContext = await buildClassifierContext({
    supabase: supabaseAdmin,
    workspaceId,
    profileId,
    channel: channel ?? null,
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

  // ADR-0184 — record memory_read. Memories are the continuity signal between
  // sessions; recording count (not content — content is already in the
  // prompt-built recording) lets replay surface "agent had N memories
  // available" without duplicating the full list.
  try {
    getRecorder()?.recordTurn({
      sessionId,
      workspaceId,
      profileId,
      turnKind: "memory_read",
      phase: "context_collect",
      content: {
        memory_count: ctx.relevantMemories?.length ?? 0,
      },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  // Step 3b: Inject prior onboarding context (Lise → Botsson handoff)
  const onboardingCtx = await loadOnboardingContext(profileId, workspaceId);
  if (onboardingCtx) {
    ctx.priorOnboarding = onboardingCtx.prior_onboarding as AgentContext["priorOnboarding"];
  }

  // Step 3c: Fetch active mission + roadmap summary (prepended to prompt).
  // Runs fire-and-forget: fetchActiveStateSummary swallows DB errors and
  // returns "" — a failure here must never break the primary chat path.
  // The resulting string is ≤ 2-3 lines (N missions + next-7-day events).
  const missionSummary = await fetchActiveStateSummary(profileId, workspaceId, supabaseAdmin);

  // Step 4: Select tools based on intent + authority
  const selectedTools = selectTools(intent, authorityConfig, channel);

  // Step 5: Build posture-aware system prompt
  const systemPrompt = buildBotssonPromptFromContext(
    ctx,
    selectedTools.map((t) => `${t.name}: ${t.description}`),
  );

  // Inject current mission + roadmap state into the prompt so Botsson can
  // answer "what next?" and "what's coming up?" without a tool call.
  // missionSummary is "" when there is nothing to report or on DB errors.
  let finalSystemPrompt = systemPrompt;
  if (missionSummary) {
    finalSystemPrompt += `\n\n## Nåværende status\n${missionSummary}`;
  }

  // Inject page context into system prompt so Emma knows where the user is
  if (pageContext) {
    finalSystemPrompt += `\n\n## Brukerens skjerm\nBrukeren er pa: ${pageContext}`;
  }

  // Inject Botsson context pipe blocks when available.
  // userContext and workspaceContext arrive at session start (voice: via LiveKit data channel;
  // chat: forwarded by BFF). routeContext updates on every page navigation.
  if (userContext) {
    const dept = userContext.department_id ? ` | avdeling: ${userContext.department_id}` : "";
    finalSystemPrompt += `\n\n## Brukerkontekst\nNavn: ${userContext.display_name} | Rolle: ${userContext.role} | Status: ${userContext.status}${dept} | Sprak: ${userContext.language}`;
  }
  if (workspaceContext) {
    const parts: string[] = [`Arbeidsplass: ${workspaceContext.name}`];
    if (workspaceContext.niche) parts.push(`Bransje: ${workspaceContext.niche}`);
    if (workspaceContext.active_season_id)
      parts.push(`Aktiv sesong: ${workspaceContext.active_season_id}`);
    if (workspaceContext.planning_cycle_id)
      parts.push(`Planleggingssyklus: ${workspaceContext.planning_cycle_id}`);
    finalSystemPrompt += `\n\n## Arbeidsplasskontekst\n${parts.join(" | ")}`;
  }
  if (routeContext) {
    let routeLine = `Side: ${routeContext.path}`;
    if (routeContext.entity_type && routeContext.entity_id) {
      const label = routeContext.entity_label ? ` (${routeContext.entity_label})` : "";
      routeLine += ` | Fokusert: ${routeContext.entity_type} ${routeContext.entity_id}${label}`;
    }
    finalSystemPrompt += `\n\n## Rutekontekst\n${routeLine}`;
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
    wizardSessionId,
    userContext,
    workspaceContext,
    routeContext,
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
