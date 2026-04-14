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
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  pageContext: z.string().optional(),
  /** Optional mission context from emma_task */
  mission: z.string().optional(),
  missionContext: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Auth — any authenticated user (not admin-only)
  const supabase = await createClient();
  const {
    data: { user, session },
    error: authError,
  } = await supabase.auth.getUser().then(async (userResult) => {
    const sessionResult = await supabase.auth.getSession();
    return {
      data: { user: userResult.data.user, session: sessionResult.data.session },
      error: userResult.error ?? sessionResult.error,
    };
  });

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // 5. Proxy to stage-engine /agent/chat
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (STAGE_ENGINE_API_KEY) {
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
        user_jwt: session?.access_token, // Pass JWT for user-scoped PII writes
      }),
    });

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(errBody.message ?? `Stage engine returned ${res.status}`);
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Emma chat failed";
    console.error("[/api/emma/chat] stage-engine proxy error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
