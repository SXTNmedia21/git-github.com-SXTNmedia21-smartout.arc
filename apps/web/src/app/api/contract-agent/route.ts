import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { runContractAgent } from "@smartout/ai/agents/contract";
import type { ModelMessage, ContractToolContext } from "@smartout/ai/agents/contract";

const RequestSchema = z.object({
  templateId: z.string(),
  userMessage: z.string().min(1).max(10000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
  editorState: z
    .object({
      html: z.string(),
      text: z.string(),
    })
    .nullable(),
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

  // 2. Super admin check — contract editor is platform-admin only
  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();

  if (!identity?.is_godmode) {
    return NextResponse.json({ error: "Forbidden — super admin only" }, { status: 403 });
  }

  // 3. Parse & validate input
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

  try {
    // 4. Build context for the contract agent
    const ctx: ContractToolContext = {
      editorState: body.editorState,
      templateId: body.templateId,
    };

    const history = body.conversationHistory as ModelMessage[];

    // 5. Run the contract agent
    const result = await runContractAgent({
      ctx,
      userMessage: body.userMessage,
      conversationHistory: history,
    });

    return NextResponse.json({
      text: result.text,
      actions: result.actions,
      toolCalls: result.toolCalls,
    });
  } catch (err) {
    console.error("Contract agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
