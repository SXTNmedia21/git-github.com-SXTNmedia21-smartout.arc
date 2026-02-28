import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { runDocsAgent } from "@smartout/ai";
import type { ModelMessage } from "@smartout/ai";
import { getUserManualDocs, searchUserManual } from "@/lib/user-manual";

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .optional()
    .default([]),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof RequestSchema>;

  try {
    const raw = await request.json();
    body = RequestSchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const allDocs = getUserManualDocs();
    const matchedDocs = searchUserManual(body.message, 6);
    const prioritized = [
      ...matchedDocs,
      ...allDocs.filter((doc) => !matchedDocs.some((matched) => matched.slug === doc.slug)),
    ];

    const knowledge = prioritized.map((doc) => ({
      title: doc.title,
      href: `/docs/${doc.slug}`,
      content: doc.content,
    }));

    const result = await runDocsAgent({
      question: body.message,
      conversationHistory: body.history as ModelMessage[],
      knowledge,
    });

    return NextResponse.json({
      answer: result.answer,
      sources: knowledge.map((doc) => ({ title: doc.title, href: doc.href })),
    });
  } catch (error) {
    console.error("docs-agent error", error);
    return NextResponse.json(
      { error: "Docs agent failed to generate a response." },
      { status: 500 },
    );
  }
}
