import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import {
  SessionContext,
  runOnboardingAgent,
  extractOnboardingIntelligence,
} from "@smartout/ai";
import type { ModelMessage } from "@smartout/ai";

const RequestSchema = z.object({
  sessionId: z.string().uuid(),
  userMessage: z.string().min(1).max(5000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  extractIntelligence: z.boolean().optional().default(false),
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
        ? err.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Session ownership check
  const { data: session, error: sessionError } = await supabase
    .from("onboarding_session")
    .select("id, user_id")
    .eq("id", body.sessionId)
    .single<{ id: string; user_id: string | null }>();

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Onboarding session not found" },
      { status: 404 },
    );
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const ctx = new SessionContext(supabase, body.sessionId);
    const history = body.conversationHistory as ModelMessage[];

    // 4a. Extract intelligence (final step of conversation)
    if (body.extractIntelligence) {
      const allMessages: ModelMessage[] = [
        ...history,
        { role: "user", content: body.userMessage },
      ];

      const intelligence = await extractOnboardingIntelligence({
        conversationHistory: allMessages,
      });

      return NextResponse.json({ intelligence });
    }

    // 4b. Run conversation agent
    const result = await runOnboardingAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory: history,
    });

    return NextResponse.json({
      text: result.text,
      toolCalls: result.toolCalls,
      toolResults: result.toolResults,
    });
  } catch (err) {
    console.error("Onboarding agent error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
