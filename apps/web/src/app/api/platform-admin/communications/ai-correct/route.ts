import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";

const RequestSchema = z.object({
  text: z.string().min(1).max(10000),
  locale: z.enum(["no", "en"]).default("no"),
});

export async function POST(request: Request) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = RequestSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const { text, locale } = body.data;

  try {
    const adminClient = createAdminClient();
    const openrouterKey = await getServiceKey(adminClient, "openrouter");

    const systemPrompt =
      locale === "no"
        ? "Du er en profesjonell korrekturleser for norsk forretningskommunikasjon. Korriger grammatikk, tegnsetting og ordvalg. Behold meningen og tonen, men gjor teksten mer profesjonell og klar. Returner kun den korrigerte teksten, ingen forklaringer."
        : "You are a professional proofreader for business communications. Correct grammar, punctuation, and word choice. Keep the meaning and tone, but make the text more professional and clear. Return only the corrected text, no explanations.";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const corrected = data.choices?.[0]?.message?.content?.trim();

    if (!corrected) {
      return NextResponse.json({ error: "No response from AI" }, { status: 502 });
    }

    return NextResponse.json({ corrected });
  } catch (err) {
    console.error("AI correction error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
