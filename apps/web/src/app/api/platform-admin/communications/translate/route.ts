import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createAdminClient } from "@smartout/supabase/admin";
import { getServiceKey } from "@smartout/supabase/vault";

const RequestSchema = z.object({
  text: z.string().min(1).max(10000).optional(),
  fields: z.record(z.string()).optional(),
  fromLocale: z.enum(["no", "en"]).default("no"),
  toLocale: z.enum(["no", "en"]),
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

  const { text, fields, fromLocale, toLocale } = body.data;

  if (fromLocale === toLocale) {
    return NextResponse.json({ translated: text, translatedFields: fields });
  }

  if (!text && !fields) {
    return NextResponse.json({ error: "Either text or fields is required" }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();
    const openrouterKey = await getServiceKey(adminClient, "openrouter");

    const langNames: Record<string, string> = {
      no: "Norwegian",
      en: "English",
    };
    const contentToTranslate = fields
      ? Object.entries(fields)
          .map(([key, val]) => `[${key}]: ${val}`)
          .join("\n---\n")
      : text!;

    const systemPrompt = `Translate the following from ${langNames[fromLocale]} to ${langNames[toLocale]}. Preserve formatting, HTML tags, and line breaks. Return only the translation.${fields ? " Each section is labeled with [key]: — preserve the labels." : ""}`;

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
          { role: "user", content: contentToTranslate },
        ],
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Translation service error" }, { status: 502 });
    }

    const data = await res.json();
    const translated = data.choices?.[0]?.message?.content?.trim();

    if (!translated) {
      return NextResponse.json({ error: "No translation received" }, { status: 502 });
    }

    if (fields) {
      const translatedFields: Record<string, string> = {};
      const sections = translated.split(/\n---\n/);
      const keys = Object.keys(fields);
      keys.forEach((key, i) => {
        const section = sections[i] ?? "";
        translatedFields[key] = section.replace(new RegExp(`^\\[${key}\\]:\\s*`), "").trim();
      });
      return NextResponse.json({ translatedFields });
    }

    return NextResponse.json({ translated });
  } catch (err) {
    console.error("Translation error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
