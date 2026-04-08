/**
 * POST /api/botsson/chat
 *
 * Admin-facing chat endpoint that runs one turn of Botsson against the active workspace.
 * Wraps `runBotssonAgent` from @smartout/ai. The chat UI in EmmaOverlay POSTs here on every
 * user message and renders the returned text + any InputRequestDescriptors.
 *
 * Auth: must be authenticated AND have admin/owner role in the active workspace. Botsson
 * mutation tools (create/send contracts, etc.) re-check role internally as a defense layer.
 *
 * Channel: V0 hard-codes 'chat' since this is the typed-input endpoint. Voice has its own
 * runtime path through Ultravox. ADR-0078's three-layer channel restriction lives at:
 *   1. The active session channel (this endpoint = chat)
 *   2. The capability's allowed_channels (set per capability definition — V0 not enforced)
 *   3. The InputRequest's allowed_channels (PII forces chat-only via buildInputRequest)
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { runBotssonAgent } from "@smartout/ai/agents/botsson";
import type { ModelMessage, AgentToolContext } from "@smartout/ai/agents/botsson";

// ── Request schema ──────────────────────────────────────────────────────────
const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  /** Optional context the UI passes when admin clicks "Lag kontrakt for X" — primes Botsson */
  primeContext: z
    .object({
      kind: z.string(), // 'create_contract', 'view_employee', etc.
      profileId: z.string().uuid().optional(),
      profileName: z.string().optional(),
    })
    .optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
      }),
    )
    .max(40), // hard cap so the LLM context doesn't run away
});

export async function POST(request: NextRequest) {
  // 1. Auth — must be a real authenticated user.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate body.
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

  // 3. Resolve the caller's profile in the requested workspace + check admin role.
  // Botsson mutation tools re-check this; the endpoint check is the first layer.
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

  // 4. Build the AgentToolContext that capability tools require.
  // sessionId is synthetic for now — V0 doesn't persist Botsson admin chats. When we add
  // engine_sessions integration we'll write a real session row and propagate the id here.
  const ctx: AgentToolContext = {
    workspaceId: body.workspaceId,
    profileId: profile.profile_id,
    userId: user.id,
    sessionId: `botsson-chat-${Date.now()}`,
    supabaseAdmin: admin,
  };

  // 5. If the UI passed primeContext, prepend a system-style hint to the user message so
  // Botsson knows the entry point. We do NOT add a separate system message — runBotssonAgent
  // already injects its own system prompt; this is contextual framing for THIS turn only.
  let userMessage = body.userMessage;
  if (body.primeContext && body.conversationHistory.length === 0) {
    // Only prime on the very first turn of a conversation. After that the model has context.
    const ctxLines: string[] = [];
    if (body.primeContext.kind === "create_contract") {
      ctxLines.push("[Kontekst: Admin åpnet deg fra kontraktsiden for å lage en ny kontrakt.]");
    } else if (body.primeContext.kind === "view_employee") {
      ctxLines.push("[Kontekst: Admin åpnet deg fra ansattprofilen.]");
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

  // 6. Run one turn.
  try {
    const result = await runBotssonAgent({
      ctx,
      channel: "chat",
      userMessage,
      conversationHistory: body.conversationHistory as ModelMessage[],
    });

    return NextResponse.json({
      text: result.text,
      inputRequests: result.inputRequests,
      toolResults: result.toolResults,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Botsson chat failed";
    console.error("[/api/botsson/chat] runBotssonAgent error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
