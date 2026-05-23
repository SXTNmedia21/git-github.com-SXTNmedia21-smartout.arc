/**
 * POST /api/botsson/chat
 *
 * Admin-facing chat endpoint that proxies to stage-engine's /agent/chat.
 * This gives chat the same pipeline as voice: sessions, memory, relationship,
 * authority-gated tools, intent classification, and context windowing.
 *
 * Auth: must be authenticated AND have admin/owner role in the active workspace.
 * Stage-engine re-checks via its own auth middleware.
 *
 * Auth resolution (mirrors /api/emma/chat per ADR-0239):
 * - Cookie path: standard Supabase SSR session (web dashboard).
 * - Bearer path: Authorization: Bearer <supabase_access_token> (mobile/godmode).
 *   Bearer takes precedence over x-api-key when forwarding to stage-engine so
 *   RLS-enforced writes resolve correctly.
 *
 * Session persistence: the frontend passes session_id back on subsequent turns.
 * Stage-engine creates and maintains the real engine_sessions row.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";
import {
  assembleBotssonContext,
  isBotssonContextError,
  stripUserContextForWire,
} from "@/lib/botsson-context-snapshot";

const STAGE_ENGINE_URL = env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const STAGE_ENGINE_API_KEY = env.STAGE_ENGINE_API_KEY;

// ── Nested Zod schemas for client_tools + client_tool roundtrip ─────────────

/**
 * Mirrors ClientToolParameter from packages/ai/src/harness/types.ts.
 * Declared here (rather than imported from @smartout/ai/harness) because the
 * harness subpath export is not yet wired in packages/ai/package.json (Phase 3
 * of ADR-0327 wires the subpath). TypeScript's structural typing keeps these
 * assignment-compatible.
 */
const ClientToolParameterSchema = z.object({
  name: z.string(),
  location: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  schema: z.union([
    z.object({ type: z.literal("string"), enum: z.array(z.string()).optional() }),
    z.object({ type: z.literal("number") }),
    z.object({ type: z.literal("boolean") }),
    z.object({ type: z.literal("object"), properties: z.record(z.unknown()).optional() }),
    z.object({ type: z.literal("array"), items: z.unknown().optional() }),
  ]),
});

/**
 * Mirrors ClientToolDefinition from packages/ai/src/harness/types.ts (lines 36-43).
 * The LiveKit Agents wire format for registering client-side tools with the
 * Realtime LLM. BFF forwards these verbatim to stage-engine so it can
 * surface them in the LLM session without server-side re-encoding.
 */
const ClientToolDefinitionSchema = z.object({
  temporaryTool: z.object({
    modelToolName: z.string(),
    description: z.string(),
    dynamicParameters: z.array(ClientToolParameterSchema),
    client: z.record(z.never()),
  }),
});

/**
 * One entry in the `client_tool_results` array — sent by browser back to
 * stage-engine to complete a client-tool roundtrip (Phase 3.5b).
 * Mirrors ClientToolCallResult in packages/ai/src/harness/types.ts.
 * Inlined here for the same reason as ClientToolDefinitionSchema above
 * (harness subpath not yet exported).
 */
const ClientToolCallResultSchema = z.object({
  tool_call_id: z.string(),
  result: z.string(),
  is_error: z.boolean().optional(),
});

// ── Request schema ──────────────────────────────────────────────────────────
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  pageContext: z.string().optional(),
  primeContext: z
    .object({
      kind: z.string(),
      profileId: z.string().uuid().optional(),
      profileName: z.string().optional(),
    })
    .optional(),
  /** Optional mission context (e.g. "journey_authoring") */
  mission: z.string().optional(),
  missionContext: z.record(z.unknown()).optional(),
  /** ADR-0239: forward wizard_session_id to stage-engine when
   *  mission="journey_authoring". Stage-engine threads it into
   *  AgentToolContext.wizardSessionId so save_draft + publish_draft
   *  tools can write to wizard_session.* without conflating
   *  engine_sessions.id with wizard_session_id. */
  wizardSessionId: z.string().uuid().optional(),
  /**
   * Optional array of client-side tool definitions (LiveKit Agents format).
   * When present, BFF forwards these verbatim to stage-engine so the chat
   * session can invoke view-state tools that execute on the client
   * (e.g. navigate_to_shift, set_schedule_view_date). Absent = backward-compatible.
   * Shape mirrors ClientToolDefinition in packages/ai/src/harness/types.ts.
   */
  client_tools: z.array(ClientToolDefinitionSchema).optional(),
  /**
   * Phase 3.5b client-tool roundtrip: results from browser-executed client tools.
   * When the previous stage-engine response contained `client_tool_calls`, the
   * browser executes each tool locally and sends results back here. BFF forwards
   * them verbatim to stage-engine so the LLM run can be resumed with the tool
   * results filled in. Absent = no roundtrip in progress (backward-compatible).
   * Shape mirrors ClientToolCallResult in packages/ai/src/harness/types.ts.
   */
  client_tool_results: z.array(ClientToolCallResultSchema).optional(),
});

/**
 * Resolves auth from either the cookie session (web) or a Bearer header (mobile/godmode).
 * Mirrors the resolveAuth pattern in /api/emma/chat (ADR-0132, ADR-0239).
 * Bearer path validates via admin client so the raw token can be forwarded
 * to stage-engine for RLS-enforced writes without a null-session hazard.
 */
async function resolveAuth(
  request: NextRequest,
): Promise<{ user: { id: string }; accessToken: string | undefined } | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: data.user, accessToken: bearerToken };
  }

  // Cookie path (web). Standard SSR session.
  const supabase = await createClient();
  const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (userErr || sessionErr || !userData.user) return null;
  return {
    user: userData.user,
    accessToken: sessionData.session?.access_token,
  };
}

export async function POST(request: NextRequest) {
  // 1. Auth — cookie OR Bearer (mirrors /api/emma/chat per ADR-0239)
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, accessToken } = auth;

  // 2. Parse body
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Resolve profile + check admin role
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profile")
    .select("profile_id, role, status")
    .eq("user_id", user.id)
    .eq("workspace_id", body.workspaceId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found in workspace" }, { status: 403 });
  }
  if (profile.role !== "admin" && profile.role !== "owner") {
    return NextResponse.json({ error: "Botsson chat is admin/owner only" }, { status: 403 });
  }
  if (profile.status !== "active") {
    return NextResponse.json({ error: "Profile is not active" }, { status: 403 });
  }

  // 4. Build prime context on first turn
  let userMessage = body.userMessage;

  // 4a. Legacy primeContext (create_contract / view_employee kinds)
  if (body.primeContext && !body.sessionId) {
    const ctxLines: string[] = [];
    if (body.primeContext.kind === "create_contract") {
      ctxLines.push("[Kontekst: Admin apnet deg fra kontraktsiden for a lage en ny kontrakt.]");
    } else if (body.primeContext.kind === "view_employee") {
      ctxLines.push("[Kontekst: Admin apnet deg fra ansattprofilen.]");
    }

    // ADR-0151: body-supplied profileId identifies the *subject* employee being viewed.
    // We NEVER trust this value directly — server-verify it exists in the workspace
    // before interpolating into the LLM context. A forged profileId that does not
    // correspond to a real workspace member is silently dropped (context omitted).
    // profileName is non-sensitive display text and safe to pass through.
    if (body.primeContext.profileId && body.primeContext.profileName) {
      const { data: subjectProfile } = await admin
        .from("profile")
        .select("profile_id")
        .eq("profile_id", body.primeContext.profileId)
        .eq("workspace_id", body.workspaceId)
        .maybeSingle();

      if (subjectProfile) {
        // Use the server-verified profile_id, not the raw body value
        ctxLines.push(
          `[Aktuell ansatt: ${body.primeContext.profileName} (profile_id: ${subjectProfile.profile_id})]`,
        );
      }
      // Forged or non-existent profileId: context line silently omitted — no leakage
    }

    if (ctxLines.length > 0) {
      userMessage = `${ctxLines.join(" ")}\n\n${userMessage}`;
    }
  }

  // 4b. journey_authoring prime context — verbatim from /api/emma/chat (ADR-0239)
  if (!body.sessionId && body.mission === "journey_authoring") {
    // Prepend journey-authoring wizard prime context.
    // Content mirrors SYSTEM_PROMPT in packages/ai/src/agents/journey.ts (lines 25-80).
    // Injected only on the first turn (no sessionId) so stage-engine gets full context
    // before it creates the session. Subsequent turns reuse the existing session.
    const contextLines = [
      "[Misjon: journey_authoring — definer ny journey via 6-fase wizard.]",
      "[DIN ROLLE: Guide brukeren gjennom 6 faser for å definere en komplett journey. Vær grundig, still gode oppfølgingsspørsmål.]",
      "[FASE 1 — DISCOVERY: Forstå HVA brukeren skal kunne gjøre. Spør om mål, hvem, når, trigger. Resultat: title, trigger_description]",
      "[FASE 2 — CLASSIFICATION: Kategoriser journeyen. Foreslå module, actor, platform, priority, tags. Sjekk duplikater og relaterte journeys. Resultat: module, actor, platform, priority, tags]",
      "[FASE 3 — STEPS: Definer steg-for-steg. Hvert steg: title, action, expects, screen, component. Ett steg = én brukerhandling. Resultat: steps array]",
      "[FASE 4 — TESTING: Definer testverdier. Foreslå test_assertion (en-linjers E2E-sjekk), preconditions. Resultat: test_assertion, preconditions]",
      "[FASE 5 — DOCUMENTATION: Norske titler og utfall. Foreslå doc_title (norsk), outcomes_success, outcomes_empty, outcomes_error. Resultat: doc_title, outcomes]",
      "[FASE 6 — REVIEW: Vis komplett oversikt formatert. Lagre utkast. Vent på brukerens godkjenning før du erklærer deg ferdig.]",
      "[REGLER: Lagre draft etter hver fase. Snakk norsk, bruk engelske verdier for tekniske felt. Foreslå verdier proaktivt. Vis fase-progresjon: 'Fase X/6: Navn'. Slug auto-genereres fra title. Code (J-XXX) tildeles ved lagring.]",
      "[SMARTOUT KONTEKST — 18 moduler: core, onboarding, org, scheduling, operations, haccp, training, absence, payroll, communication, reports, settings, ai, season, governance, contracts, certifications, meta]",
      "[6 aktørtyper: employee, trainee, manager, admin, owner, all | 3 plattformer: mobile, desktop, both | 4 prioriteter: P0 (Critical), P1 (Important), P2 (Nice to have), P3 (Future)]",
      "[En journey er 'en aktør som oppnår et mål gjennom en sekvens av steg']",
    ];

    userMessage = `${contextLines.join("\n")}\n\n${userMessage}`;
  }

  // 5. Assemble Botsson context snapshot (user + workspace + workforce).
  //    Mirror of voice path so chat is at least as fully informed as voice
  //    (2026-05-13 S4 directive). Fail-soft: if assembly errors, chat still
  //    works with stage-engine running context-blind — stage-engine's
  //    context-block schemas are all optional.
  const ctxResult = await assembleBotssonContext(admin, user.id, body.workspaceId);
  const ctx = isBotssonContextError(ctxResult) ? null : ctxResult;
  if (!ctx) {
    console.warn(
      "[/api/botsson/chat] context-snapshot assembly failed:",
      isBotssonContextError(ctxResult) ? ctxResult.error : "unknown",
    );
  }

  // 6. Proxy to stage-engine /agent/chat
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Auth precedence (ADR-0239 fix):
    // 1. Forward user JWT as Authorization: Bearer — stage-engine validateJwt
    //    resolves workspace from auth.users metadata. This is the canonical
    //    path for godmode admin flows (wizard, helpdesk).
    // 2. Fallback to x-api-key only if no user JWT (system call sites).
    if (accessToken) {
      headers["authorization"] = `Bearer ${accessToken}`;
    } else if (STAGE_ENGINE_API_KEY) {
      headers["x-api-key"] = STAGE_ENGINE_API_KEY;
    }

    const res = await fetch(`${STAGE_ENGINE_URL}/agent/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: userMessage,
        session_id: body.sessionId,
        profile_id: profile.profile_id,
        channel: "chat",
        page_context: body.pageContext,
        user_jwt: accessToken, // Pass JWT for user-scoped PII writes
        // ADR-0239: forward wizard_session_id when present so stage-engine
        // tool ctx exposes it as ctx.wizardSessionId. Distinct from
        // session_id (= engine_sessions.id) — never conflate.
        wizard_session_id: body.wizardSessionId,
        // S4 chat-voice parity (2026-05-13): forward Botsson context blocks so
        // chat has the same session-start context as voice. profile_id is
        // stripped — stage-engine derives it server-side (ADR-0151).
        ...(ctx
          ? {
              user_context: stripUserContextForWire(ctx.user),
              workspace_context: ctx.workspace,
              workforce_context: ctx.workforce,
            }
          : {}),
        // Phase 3 harness: forward client-side tool definitions when present
        // so stage-engine can surface view-state tools to the chat LLM.
        // Absent = field omitted entirely (backward-compatible with stage-engine
        // instances that do not yet read client_tools).
        ...(body.client_tools !== undefined ? { client_tools: body.client_tools } : {}),
        // Phase 3.5b harness: forward client-tool roundtrip results when present
        // so stage-engine can resume the LLM run with browser-executed tool results.
        // Absent = field omitted entirely (backward-compatible).
        ...(body.client_tool_results !== undefined
          ? { client_tool_results: body.client_tool_results }
          : {}),
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      const passthroughStatuses = new Set([401, 403, 404, 409]);
      const status = passthroughStatuses.has(res.status) ? res.status : 500;
      console.error(
        `[/api/botsson/chat] stage-engine error ${res.status}:`,
        errBody.error ?? errBody.message,
      );
      return NextResponse.json(
        {
          error: errBody.error ?? "STAGE_ENGINE_ERROR",
          message: errBody.message ?? `Stage engine returned ${res.status}`,
        },
        { status },
      );
    }

    const data = (await res.json()) as {
      session_id: string;
      response: string;
      intent?: { capability: string; confidence: number };
      client_tool_calls?: Array<{
        tool_call_id: string;
        name: string;
        arguments: Record<string, unknown>;
      }>;
    };

    return NextResponse.json({
      text: data.response,
      sessionId: data.session_id,
      intent: data.intent,
      // Phase 3.5b: propagate client_tool_calls to browser when stage-engine
      // requests browser-side tool execution. Absent when no client tools were
      // invoked (backward-compatible: existing clients ignore unknown fields).
      ...(data.client_tool_calls !== undefined
        ? { client_tool_calls: data.client_tool_calls }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Botsson chat failed";
    console.error("[/api/botsson/chat] stage-engine proxy error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
