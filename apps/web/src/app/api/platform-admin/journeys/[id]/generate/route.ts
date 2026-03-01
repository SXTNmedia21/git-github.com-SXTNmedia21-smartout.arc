// ============================================
// route.ts — Generate Journey Output
// POST: Generates an output (e2e, doc, linear, botsson)
// for a specific journey on demand.
// Connected to: packages/ai/src/generators/
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import {
  generateE2ETest,
  generateOnboardingDoc,
  generateLinearSpec,
  generateBotssonScript,
} from "@smartout/ai";

const RequestSchema = z.object({
  type: z.enum(["e2e", "doc", "linear", "botsson"]),
});

type Props = { params: Promise<{ id: string }> };

/**
 * Generates a specific output type for a journey.
 * Requires godmode access. Fetches the journey and steps,
 * runs the appropriate generator, and returns the content.
 *
 * @param request - POST body with { type: "e2e" | "doc" | "linear" | "botsson" }
 * @param params - Route params with journey ID
 * @returns Generated content string
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: identity } = await admin
    .from("user_identity")
    .select("is_godmode")
    .eq("user_id", user.id)
    .single();
  if (!identity?.is_godmode) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Fetch journey + steps in parallel
  const [{ data: journey }, { data: steps }] = await Promise.all([
    admin.from("journey").select("*").eq("journey_id", id).single(),
    admin.from("journey_step").select("*").eq("journey_id", id).order("step_order"),
  ]);

  if (!journey) return NextResponse.json({ error: "Journey not found" }, { status: 404 });

  // Cast to match expected types — database rows match the Zod schema shapes
  const journeyData = journey as unknown as import("@smartout/types").Journey;
  const stepsData = (steps ?? []) as unknown as import("@smartout/types").JourneyStep[];

  let content: string;
  switch (body.type) {
    case "e2e":
      content = generateE2ETest(journeyData, stepsData);
      break;
    case "doc":
      content = generateOnboardingDoc(journeyData, stepsData);
      break;
    case "linear":
      content = generateLinearSpec(journeyData, stepsData);
      break;
    case "botsson":
      content = generateBotssonScript(journeyData, stepsData);
      break;
  }

  // Log generation event
  await admin.from("journey_event").insert({
    journey_id: id,
    workspace_id: journey.workspace_id,
    event_type: "output_generated" as never,
    metadata: { output_type: body.type },
  });

  return NextResponse.json({
    type: body.type,
    content,
    generated_at: new Date().toISOString(),
  });
}
