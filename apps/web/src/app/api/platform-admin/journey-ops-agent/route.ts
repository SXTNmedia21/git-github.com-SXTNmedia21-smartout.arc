// ============================================
// journey-ops-agent/route.ts — Journey Operations Agent endpoint
//
// POST: takes a user message + conversation history + current journey id,
// runs the agent (one turn = up to 8 tool calls), returns text + tool log.
//
// Connected to: packages/ai/src/agents/journey-ops.ts (agent logic)
// Connected to: apps/web/src/app/platform-admin/journeys/[id]/_components/journey-ops-chat.tsx (UI)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";
import { runJourneyOpsAgent } from "@smartout/ai/agents/journey-ops";
import type { ModelMessage, JourneyOpsToolContext } from "@smartout/ai/agents/journey-ops";
import { getSuperAdminId } from "@/lib/platform-admin";

const RequestSchema = z.object({
  userMessage: z.string().min(1).max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system", "tool"]),
      content: z.string(),
    }),
  ),
  currentJourneyId: z.string().uuid().nullable(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  let openrouterKey: string | null = null;
  try {
    openrouterKey = await getServiceKey(admin, "openrouter");
  } catch {
    openrouterKey = null;
  }

  const ctx: JourneyOpsToolContext = {
    admin,
    actorId: adminId,
    currentJourneyId: body.currentJourneyId,
    openrouterKey,
  };

  // ai-sdk's ModelMessage has stricter `content` typing. The role-narrowed
  // history we accept on the wire only carries text content, so cast to its
  // expected shape.
  const history = body.conversationHistory as unknown as ModelMessage[];

  try {
    const result = await runJourneyOpsAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory: history,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[journey-ops-agent] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent run failed" },
      { status: 500 },
    );
  }
}
