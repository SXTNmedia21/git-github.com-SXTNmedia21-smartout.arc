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
 * Session persistence: the frontend passes session_id back on subsequent turns.
 * Stage-engine creates and maintains the real engine_sessions row.
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
  primeContext: z
    .object({
      kind: z.string(),
      profileId: z.string().uuid().optional(),
      profileName: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  // 4. Prepend primeContext to message on first turn
  let userMessage = body.userMessage;
  if (body.primeContext && !body.sessionId) {
    const ctxLines: string[] = [];
    if (body.primeContext.kind === "create_contract") {
      ctxLines.push("[Kontekst: Admin apnet deg fra kontraktsiden for a lage en ny kontrakt.]");
    } else if (body.primeContext.kind === "view_employee") {
      ctxLines.push("[Kontekst: Admin apnet deg fra ansattprofilen.]");
    }
    if (body.primeContext.profileId && body.primeContext.profileName) {
      ctxLines.push(
        `[Aktuell ansatt: ${body.primeContext.profileName} (profile_id: ${body.primeContext.profileId})]`,
      );
    }
    if (ctxLines.length > 0) {
      userMessage = `${ctxLines.join(" ")}\n\n${userMessage}`;
    }
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
        channel: "chat",
        page_context: body.pageContext,
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
    const message = err instanceof Error ? err.message : "Botsson chat failed";
    console.error("[/api/botsson/chat] stage-engine proxy error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
