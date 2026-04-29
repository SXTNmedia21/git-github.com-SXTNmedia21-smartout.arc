/**
 * POST /api/emma/chat
 *
 * Employee-facing chat endpoint that proxies to stage-engine /agent/chat.
 * Unlike /api/botsson/chat (admin-only), this is available to any
 * authenticated user with a profile in the workspace.
 *
 * Key differences from botsson/chat:
 * - No admin/owner role requirement — any authenticated profile can use it
 * - Passes the user's JWT to stage-engine for RLS-enforced PII writes
 * - Always channel: "chat" (enforced — PII never via voice, ADR-0078)
 * - Detects active pending_data contracts and prepends prime context
 *
 * Auth (per ADR-0132 — mobile thin client):
 * - Web (cookie): standard Supabase SSR cookie session
 * - Mobile (Bearer): Authorization: Bearer <supabase_access_token> header.
 *   Bearer path validates via admin.auth.getUser(token); the raw token IS
 *   the access_token forwarded to stage-engine for RLS-enforced PII writes.
 *   Bearer path MUST NOT call getSession() — there is no session in
 *   stateless mode and a null session would silently break PII writes.
 *
 * NOTE: `channel` is forced to "chat" server-side. The endpoint never
 * accepts a `channel` field from the client — voice traffic gets its own
 * endpoint (Week 7+, LiveKit per ADR-0135).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";

const STAGE_ENGINE_URL = env.STAGE_ENGINE_URL ?? "http://localhost:5010";
const STAGE_ENGINE_API_KEY = env.STAGE_ENGINE_API_KEY;

// ── Request schema ──────────────────────────────────────────────────────────
// Notably absent: `channel`. Server forces "chat". See ADR-0078.
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  pageContext: z.string().optional(),
  /** Optional mission context from emma_task */
  mission: z.string().optional(),
  missionContext: z.record(z.unknown()).optional(),
  /** ADR-0226: wizard_session_id forwarded to stage-engine when
   *  mission="journey_authoring". Stage-engine threads it into
   *  AgentToolContext.wizardSessionId so save_draft + publish_draft can
   *  write to the correct wizard_session row. */
  wizardSessionId: z.string().uuid().optional(),
});

type AuthResult = {
  user: { id: string };
  accessToken: string | undefined;
  authMethod: "bearer" | "cookie";
};

/**
 * Resolves auth from either the cookie session (web) or a Bearer header (mobile).
 * Bearer path uses admin client to validate the JWT — does NOT call getSession()
 * (which would return null in stateless mode and corrupt downstream PII writes).
 */
async function resolveAuth(request: NextRequest): Promise<AuthResult | null> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    // Bearer path (mobile per ADR-0132). Validate via admin client.
    // The raw token IS the access_token to forward downstream — stateless mode.
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(bearerToken);
    if (error || !data.user) return null;
    return { user: data.user, accessToken: bearerToken, authMethod: "bearer" };
  }

  // Cookie path (web). Standard SSR session.
  const supabase = await createClient();
  const [{ data: userData, error: userErr }, { data: sessionData, error: sessionErr }] =
    await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()]);
  if (userErr || sessionErr || !userData.user) return null;
  return {
    user: userData.user,
    accessToken: sessionData.session?.access_token,
    authMethod: "cookie",
  };
}

export async function POST(request: NextRequest) {
  // 1. Auth — cookie OR Bearer. Mobile clients send Bearer per ADR-0132.
  const auth = await resolveAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, accessToken, authMethod } = auth;

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

  // 3. Resolve profile (any role)
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

  // 4. Build prime context for contract intake on first turn
  let userMessage = body.userMessage;

  if (!body.sessionId && body.mission === "contract_intake") {
    // Prepend context about the contract intake task
    const contextLines = [
      "[Kontekst: Ansatt åpnet samtalen for å fylle inn opplysninger til arbeidsavtalen.]",
      "[Misjon: contract_intake — samle inn personnummer, bankkontonummer og adresse.]",
      "[VIKTIG: Aldri gjenta PII-verdier tilbake til brukeren. Bekreft kun at data er lagret.]",
    ];

    if (body.missionContext) {
      const ctx = body.missionContext;
      if (ctx.contract_id) {
        contextLines.push(`[contract_id: ${ctx.contract_id}]`);
      }
      if (ctx.employment_contract_id) {
        contextLines.push(`[employment_contract_id: ${ctx.employment_contract_id}]`);
      }
    }

    userMessage = `${contextLines.join("\n")}\n\n${userMessage}`;
  }

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

  // 5. Proxy to stage-engine /agent/chat
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    // Auth precedence (ADR-0226 fix):
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
        channel: "chat", // Always chat — PII never via voice (ADR-0078)
        page_context: body.pageContext,
        user_jwt: accessToken, // Pass JWT for user-scoped PII writes
        // ADR-0226: forward wizard_session_id when present so stage-engine
        // tool ctx exposes it as ctx.wizardSessionId. Distinct from
        // session_id (= engine_sessions.id) — never conflate.
        wizard_session_id: body.wizardSessionId,
      }),
    });

    // Preserve stage-engine status codes (401/403/404/409) so mobile can
    // distinguish "session expired" from "not allowed" from "internal error"
    // (per agent-coord council R1, hop 7).
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      const passthroughStatuses = new Set([401, 403, 404, 409]);
      const status = passthroughStatuses.has(res.status) ? res.status : 500;
      console.error(
        `[/api/emma/chat] stage-engine error ${res.status}:`,
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
    };

    return NextResponse.json({
      text: data.response,
      sessionId: data.session_id,
      intent: data.intent,
      // authMethod surfaced for mobile telemetry observability
      authMethod,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Emma chat failed";
    console.error("[/api/emma/chat] stage-engine proxy error:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
