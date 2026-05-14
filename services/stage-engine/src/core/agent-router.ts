// ============================================
// agent-router.ts
// Core routing logic for agent mode conversations.
// Pipeline: classify intent → load authority → collect context → select tools → build prompt → LLM
// Connected to: @smartout/ai (intent-classifier, tool-selector, mr-botsson, context, vercel-ai)
// Connected to: src/core/authority.ts (workspace authority config)
// ============================================

import { generateText, stepCountIs, tool, jsonSchema, type ToolSet } from "ai";
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
  WorkforceContext,
} from "@smartout/ai/capabilities/types";
import { buildBotssonPromptFromContext } from "@smartout/ai/prompts/mr-botsson";
import { toVercelTools } from "@smartout/ai/adapters/vercel-ai";
import { collectContext } from "@smartout/ai/context/collector";
import type { AgentContext } from "@smartout/ai/context/types";
import type { Situation } from "@smartout/ai/capabilities/types";
import { loadAuthorityConfig } from "./authority.js";
import { loadOnboardingContext } from "./session-manager.js";
import { fetchActiveStateSummary } from "./mission-summary.js";
import { fetchEngineWorldSurfaces, renderWorldStateBlock } from "./engine-world-reader.js";
import { recordDispatchSample, startEngineWorldWriter } from "./engine-world-writer.js";
import { getRecorder } from "./session-recorder.js";
import { GateActionFailed, SchemaCacheStale } from "../lib/errors.js";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { broadcastToSession } from "../ws/connection-manager.js";
import { getBufferedActions } from "../routes/ws.js";
import type { MissionProtocolMessage } from "@smartout/types";
import { getSecrets } from "../secrets.js";
import { baseLogger } from "../lib/logger.js";
import type { AgentChatResponse, ConversationTurn } from "../types/agent.js";
import type { ToolBundle } from "@smartout/ai/harness/types";
import type { ClientToolCall } from "@smartout/ai/harness/types";

/**
 * SMA-301 diagnostic — extracts upstream provider error context from
 * AI SDK errors. The base error-handler logs only `message` + `stack`,
 * which omits the OpenRouter HTTP responseBody where the actionable error
 * payload lives. Gate by LOG_LEVEL=debug to keep prod logs lean.
 */
function dumpProviderError(err: unknown): Record<string, unknown> {
  if (!err || typeof err !== "object") return { kind: typeof err };
  const e = err as Record<string, unknown>;
  return {
    name: e.name,
    message: e.message,
    url: e.url,
    statusCode: e.statusCode,
    responseBody: e.responseBody,
    responseHeaders: e.responseHeaders,
    isRetryable: e.isRetryable,
    requestBodyValuesPreview:
      typeof e.requestBodyValues === "object" && e.requestBodyValues !== null
        ? JSON.stringify(e.requestBodyValues).slice(0, 2000)
        : undefined,
    causeMessage:
      e.cause && typeof e.cause === "object" && "message" in (e.cause as object)
        ? (e.cause as { message: unknown }).message
        : undefined,
  };
}

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

// Start engine-world aggregation timer on first import of this module.
// Safe to call multiple times (singleton guard inside startEngineWorldWriter).
startEngineWorldWriter();

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

/**
 * Render workforce snapshot as compact Norwegian system-prompt block.
 *
 * Why slice not raw JSON: LLM reads natural language faster, reusable for
 * chat+voice, count caps keep token cost predictable. Identifiers (profile_id /
 * shift_id / department_id) are kept so tool-calls target the right entity
 * without a lookup tool.
 *
 * Cap rationale: 20 employees + 15 shifts/day + 10 absences + 6 sessions =
 * ~1.5–2 KB prompt overhead at p99. Workspaces with more people fall back to
 * "fetch by name via lookup tool" — voice has no scrollbar.
 *
 * PII (ADR-0078): names, roles, departments, phones, absence types deliberately
 * included. Bank/tax/personnummer/contract details NOT in WorkforceContext —
 * BFF cannot leak them here.
 */
function renderWorkforceSlice(wf: WorkforceContext): string {
  const lines: string[] = ["## Arbeidsstokk"];

  const snapshotAt = new Date(wf.snapshot_at);
  const ageMin = Math.round((Date.now() - snapshotAt.getTime()) / 60000);
  lines.push(`Snapshot: ${snapshotAt.toISOString()} (${ageMin} min siden)`);

  if (wf.employees.length > 0) {
    const emp = wf.employees.slice(0, 20);
    lines.push(`\n### Ansatte (${wf.employees.length})`);
    for (const e of emp) {
      const dept = e.department_name ?? "ingen avdeling";
      const phone = e.phone ? ` | ${e.phone}` : "";
      lines.push(
        `- ${e.display_name} (${e.role}, ${e.status}) — ${dept}${phone} [profile_id=${e.profile_id}]`,
      );
    }
    if (wf.employees.length > 20) {
      lines.push(`- … +${wf.employees.length - 20} flere (bruk lookup-tool for resten)`);
    }
  }

  if (wf.shifts_today.length > 0) {
    lines.push(`\n### Vakter i dag (${wf.shifts_today.length})`);
    for (const s of wf.shifts_today.slice(0, 15)) {
      const who = s.employee_name ?? "ubemannet";
      const pos = s.position_label ? ` ${s.position_label}` : "";
      const dept = s.department_name ? ` @ ${s.department_name}` : "";
      lines.push(`- ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} ${who}${pos}${dept}`);
    }
    if (wf.shifts_today.length > 15) {
      lines.push(`- … +${wf.shifts_today.length - 15} flere`);
    }
  } else {
    lines.push(`\n### Vakter i dag\nIngen vakter registrert.`);
  }

  if (wf.shifts_tomorrow.length > 0) {
    lines.push(`\n### Vakter i morgen (${wf.shifts_tomorrow.length})`);
    for (const s of wf.shifts_tomorrow.slice(0, 15)) {
      const who = s.employee_name ?? "ubemannet";
      const pos = s.position_label ? ` ${s.position_label}` : "";
      const dept = s.department_name ? ` @ ${s.department_name}` : "";
      lines.push(`- ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)} ${who}${pos}${dept}`);
    }
    if (wf.shifts_tomorrow.length > 15) {
      lines.push(`- … +${wf.shifts_tomorrow.length - 15} flere`);
    }
  }

  if (wf.absences_active.length > 0) {
    lines.push(`\n### Aktive fravær (${wf.absences_active.length})`);
    for (const a of wf.absences_active.slice(0, 10)) {
      const who = a.employee_name ?? `profile ${a.profile_id}`;
      lines.push(`- ${who}: ${a.absence_type} ${a.start_date} → ${a.end_date}`);
    }
  }

  if (wf.sessions_today.length > 0) {
    lines.push(`\n### Avdelingsøkter i dag (${wf.sessions_today.length})`);
    for (const sn of wf.sessions_today.slice(0, 6)) {
      const dept = sn.department_name ?? "ukjent avd";
      lines.push(`- ${dept} (${sn.status})`);
    }
  }

  return lines.join("\n");
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
  /** Botsson context pipe: D2+D6 workforce snapshot delivered at session start.
   *  Rendered as `## Arbeidsstokk` system-prompt block so Botsson knows employees,
   *  today/tomorrow shifts, active absences, today's sessions without tool-calls. */
  workforceContext?: WorkforceContext;
  /**
   * ADR-0327 Phase 3.5 — HarnessAdapter bundle from resolveChatTools.
   *
   * When present, bundle.definitions are converted to Vercel AI SDK tools and
   * merged into `vercelTools` before the LLM call. Client-tool-wins on name
   * collision (bundle tools override capability tools of the same name).
   *
   * When absent: behavior unchanged — only selectTools capability tools used.
   */
  bundle?: ToolBundle;
  /**
   * Names of tools that originated from the client side (browser-shipped,
   * execute in the browser rather than on the server). Subset of
   * bundle.definitions.map(d => d.temporaryTool.modelToolName).
   *
   * When the LLM picks one of these tools, stage-engine does NOT execute
   * the stub. Instead it captures the call as a ClientToolCall and returns
   * it in the response for the browser to execute (roundtrip protocol).
   *
   * Absent when bundle is absent.
   */
  clientToolNames?: Set<string>;
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
    workforceContext,
    bundle,
    clientToolNames,
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

  // Step 3d: Fetch engine_world surface snapshot for <world_state> block.
  // Council F5 — hook point is here, between fetchActiveStateSummary and selectTools.
  // Council F6 — fetchEngineWorldSurfaces returns whitelisted scalars only; details
  //              JSONB is never fetched or rendered (prompt-injection mitigation).
  // On DB error: returns null → renderWorldStateBlock returns "unavailable" sentinel.
  // Never throws — the chat pipeline must not break if engine_world is unreachable.
  const worldSurfaces = await fetchEngineWorldSurfaces(workspaceId);
  const worldStateBlock = renderWorldStateBlock(worldSurfaces);

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

  // Inject engine_world surface snapshot.
  // Council F5 — position: after missionSummary, before userContext/workspaceContext/routeContext.
  // Council F6 — worldStateBlock contains only surface_id|surface_type|status|is_stale
  //              (no details JSONB).
  // Sentinels: "empty" = table reachable but no rows; "unavailable" = DB error.
  finalSystemPrompt += `\n\n${worldStateBlock}`;

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

  // 2026-05-13: Workforce snapshot — Botsson is a workforce assistant and must
  // already know employees + today/tomorrow shifts + active absences + today's
  // sessions before the first turn (no tool-call required for these facts).
  // PII policy (ADR-0078): names, roles, departments, phones, absence types are
  // safe on both channels; bank/tax/personnummer/contract details are NEVER in
  // this block (BFF strips them server-side).
  if (workforceContext) {
    finalSystemPrompt += `\n\n${renderWorkforceSlice(workforceContext)}`;
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
    workforceContext,
    broadcast: (event: unknown) => broadcastToSession(sessionId, event as MissionProtocolMessage),
  };

  const vercelTools = toVercelTools(selectedTools, toolContext);

  // ADR-0327 Phase 3.5 — merge bundle tools from HarnessAdapter into vercelTools.
  //
  // Bundle tools come from the client (browser-shipped page-scope tools) and from
  // the capability layer via the harness. They carry JSON-schema parameters
  // (not Zod), so we build them with jsonSchema() + tool() directly.
  //
  // Merge policy: client-tool-wins on name collision. If a bundle tool shares a
  // name with a capability tool in vercelTools, the bundle version replaces it.
  // This is defense-in-depth: the resolver already applied client-tool-wins, but
  // if the same name ends up in both sets, the bundle takes precedence here too.
  //
  // Client tools (names in clientToolNames set) get a stub execute that returns
  // the placeholder string. Stage-engine detects these tool calls AFTER generateText
  // and includes them in client_tool_calls rather than executing the stub.
  const mergedTools: ToolSet = { ...vercelTools };

  if (bundle !== undefined) {
    for (const def of bundle.definitions) {
      const toolName = def.temporaryTool.modelToolName;

      // Build a JSON Schema object from the tool's dynamicParameters.
      // Each parameter maps to a property; required list is derived from
      // those that have required=true (or required not explicitly false).
      // Build a JSON Schema object for this tool's parameters.
      // ClientToolParameter.schema.type is a plain string while JSONSchema7TypeName
      // is a string literal union. We cast through unknown to satisfy the strict
      // @ai-sdk/provider JSONSchema7 type at the jsonSchema() call site below.
      const properties: Record<string, Record<string, unknown>> = {};
      const required: string[] = [];

      for (const param of def.temporaryTool.dynamicParameters) {
        properties[param.name] = { ...param.schema, description: param.description };
        if (param.required !== false) {
          required.push(param.name);
        }
      }

      const paramSchemaRaw: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) {
        paramSchemaRaw["required"] = required;
      }

      const isClientTool = clientToolNames?.has(toolName) ?? false;

      mergedTools[toolName] = tool({
        description: def.temporaryTool.description,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inputSchema: jsonSchema<Record<string, unknown>>(paramSchemaRaw as any),
        // Client tools execute in the browser, not here. The stub is never
        // invoked in the normal path — stage-engine intercepts the call before
        // executing (see client_tool_calls detection below). The stub exists
        // only as a fallback if detection logic is bypassed.
        execute: isClientTool
          ? async (_params: Record<string, unknown>): Promise<string> => {
              return "client-side tool — not directly invokable from stage-engine";
            }
          : async (params: Record<string, unknown>): Promise<string> => {
              const impl = bundle.implementations[toolName];
              if (impl === undefined) {
                return `tool implementation not found for "${toolName}"`;
              }
              return impl(params);
            },
      });
    }
  }

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
        toolCount: Object.keys(mergedTools).length,
      },
      meta: { model: llmModel },
    });
  } catch {
    // Recorder must never throw into the primary path.
  }

  const llmStart = Date.now();

  // SMA-301 diagnostic — log tool shape going into generateText.
  // Captures: tool count, names, and (debug-gated) full JSON of schemas being
  // serialized. The provider-utils path runs zod3ToJsonSchema on each
  // inputSchema; a non-roundtrippable schema produces an OpenRouter 4xx with
  // body details only visible via AI_APICallError.responseBody.
  baseLogger.debug(
    {
      sessionId,
      workspaceId,
      capability: intent.capability,
      toolCount: Object.keys(mergedTools).length,
      toolNames: Object.keys(mergedTools),
      // Full shape only at debug level to keep prod logs lean.
      vercelToolsKeys: Object.entries(mergedTools).map(([name, t]) => ({
        name,
        hasInputSchema: typeof (t as { inputSchema?: unknown }).inputSchema !== "undefined",
        type: (t as { type?: unknown }).type,
        description: (t as { description?: string }).description?.slice(0, 80),
      })),
    },
    "sma-301:generateText.pre",
  );

  // Wrapper captures error-path sample before re-throwing so the error is
  // attributed to the correct capability in the rolling bucket.
  // Council F7: recordDispatchSample is synchronous (array push only).
  const runLlm = async () => {
    try {
      return await generateText({
        model: getOpenRouter()(llmModel),
        system: finalSystemPrompt,
        messages,
        tools: mergedTools,
        stopWhen: stepCountIs(5),
      });
    } catch (err) {
      // Record error sample before propagating — p95 + error-rate aggregation
      // + engine_world write happen in the 60s setInterval tick.
      recordDispatchSample({
        latencyMs: Date.now() - llmStart,
        capability: intent.capability,
        isError: true,
      });
      // SMA-301 diagnostic — capture upstream provider error BEFORE the
      // base error-handler swallows responseBody. Always logged (not gated)
      // because this branch is the hot bug. Remove or downgrade after fix.
      baseLogger.error(
        {
          sessionId,
          workspaceId,
          capability: intent.capability,
          toolCount: Object.keys(mergedTools).length,
          toolNames: Object.keys(mergedTools),
          provider: dumpProviderError(err),
        },
        "sma-301:generateText.error",
      );
      throw err;
    }
  };

  const result = await runLlm();
  const llmLatencyMs = Date.now() - llmStart;

  // Council F7 — record success sample into rolling bucket.
  // Synchronous; no blocking of response path.
  recordDispatchSample({
    latencyMs: llmLatencyMs,
    capability: intent.capability,
    isError: false,
  });

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

  // ADR-0327 Phase 3.5 — client-tool roundtrip detection.
  //
  // After generateText, inspect toolCalls from all steps to find any calls that
  // targeted a client-shipped tool (name in clientToolNames). When found:
  //   - Build ClientToolCall entries for the browser to execute.
  //   - Return them in client_tool_calls (BFF forwards to browser).
  //   - The LLM run has already paused (stepCountIs stopped it after 5 steps or
  //     the LLM produced a final text response — either way we surface what was called).
  //
  // MVP (single-round): if client tool calls are present, they are included in
  // the response alongside any text the LLM produced. The browser executes them,
  // then sends a NEW request with client_tool_results so stage-engine can
  // seed them into conversation history and complete the LLM turn.
  //
  // We scan result.toolCalls (last-step calls) and result.steps (all step calls)
  // to capture calls that may have happened in intermediate steps.
  const detectedClientToolCalls: ClientToolCall[] = [];

  if (clientToolNames !== undefined && clientToolNames.size > 0) {
    // result.steps contains per-step data including toolCalls per step.
    // result.toolCalls is the last step only. Scanning steps covers all.
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        const name = call.toolName;
        if (clientToolNames.has(name)) {
          detectedClientToolCalls.push({
            tool_call_id: call.toolCallId,
            name,
            arguments: (call.input ?? {}) as Record<string, unknown>,
          });
        }
      }
    }
  }

  // Step 7: Return response
  const chatResponse: AgentChatResponse = {
    session_id: sessionId,
    response: result.text,
    intent: {
      capability: intent.capability,
      confidence: intent.confidence,
    },
  };

  if (detectedClientToolCalls.length > 0) {
    chatResponse.client_tool_calls = detectedClientToolCalls;
  }

  return chatResponse;
}
