// ============================================
// api/generate-content/route.ts
// AI content generation for signup flow — calls OpenRouter to generate
// Norwegian bokmål company descriptions from scraped data.
//
// Connected to: apps/web/src/env.ts (OPENROUTER_API_KEY)
// ============================================

import { env } from "@/env";
import { createClient } from "@smartout/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  companyName: z.string().min(1),
  scrapedData: z.record(z.unknown()).nullable(),
});

type GeneratedContent = {
  about_us: string;
  our_history: string;
  our_concept: string;
};

function buildPrompt(companyName: string, scrapedData: Record<string, unknown> | null): string {
  let context = "";
  if (scrapedData) {
    context = `\n\nHer er data vi har hentet fra bedriftens nettside:\n${JSON.stringify(scrapedData, null, 2)}`;
  }

  return `Du er en profesjonell innholdsskribent som skriver på norsk bokmål.

Generer tre korte tekster for bedriften "${companyName}".${context}

Returner et JSON-objekt med nøyaktig disse tre feltene:
- "about_us": En "Om oss"-tekst (2-3 setninger). Beskriv hva bedriften gjør og hva den står for.
- "our_history": En "Vår historie"-tekst (2-3 setninger). Beskriv bedriftens bakgrunn og utvikling.
- "our_concept": En "Vårt konsept"-tekst (2-3 setninger). Beskriv bedriftens unike konsept og tilnærming.

Skriv profesjonelt, varmt og engasjerende. Unngå klisjeer.
Returner KUN JSON-objektet, ingen annen tekst.`;
}

function extractJson(text: string): string {
  // Try to extract JSON from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }
  // Otherwise return as-is (might be raw JSON)
  return text.trim();
}

/**
 * POST /api/generate-content
 *
 * Generates AI content (about_us, our_history, our_concept) using OpenRouter.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate request body
  let body: z.infer<typeof RequestSchema>;
  try {
    const raw: unknown = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI service not configured (OPENROUTER_API_KEY missing)" },
      { status: 503 },
    );
  }

  const prompt = buildPrompt(body.companyName, body.scrapedData);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-20250514",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("[generate-content] OpenRouter error:", response.status, errorText);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const completion = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
    }

    const jsonStr = extractJson(rawContent);
    const parsed = JSON.parse(jsonStr) as GeneratedContent;

    // Validate the expected fields exist
    if (!parsed.about_us || !parsed.our_history || !parsed.our_concept) {
      console.error("[generate-content] Missing fields in AI response:", parsed);
      return NextResponse.json({ error: "AI returned incomplete content" }, { status: 502 });
    }

    return NextResponse.json({
      about_us: parsed.about_us,
      our_history: parsed.our_history,
      our_concept: parsed.our_concept,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-content] error:", message);
    return NextResponse.json({ error: "AI generation failed" }, { status: 500 });
  }
}
