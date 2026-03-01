// ============================================
// reports-agent/route.ts
// API route for the AI report builder.
// Authenticates the user, resolves their workspace profile,
// and delegates to the reports agent.
// Connected to: packages/ai/src/agents/reports.ts (agent logic)
// Connected to: apps/web/src/app/dashboard/reports/ (UI consumer)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { runReportsAgent } from "@smartout/ai/agents/reports";
import type { ModelMessage, ReportToolContext } from "@smartout/ai/agents/reports";

const RequestSchema = z.object({
  workspaceId: z.string().uuid(),
  userMessage: z.string().min(1).max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // 1. Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse & validate input
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

  // 3. Verify user has a profile in this workspace
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("workspace_id", body.workspaceId)
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Forbidden — not a member of this workspace" },
      { status: 403 },
    );
  }

  try {
    // 4. Build context for the reports agent
    const ctx: ReportToolContext = {
      workspaceId: body.workspaceId,
      profileId: profile.profile_id,
      supabase,
    };

    const history = body.conversationHistory as ModelMessage[];

    // 5. Run the reports agent
    const result = await runReportsAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory: history,
    });

    return NextResponse.json({
      text: result.text,
      reportData: result.reportData,
      savedReport: result.savedReport,
    });
  } catch (err) {
    console.error("Reports agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
