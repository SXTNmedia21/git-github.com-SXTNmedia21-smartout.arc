import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const Schema = z.object({
  workspaceId: z.string().uuid(),
  storagePaths: z.array(z.string().min(1)).min(1).max(20),
  bucket: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workspaceId, storagePaths, bucket } = parsed.data;
  const admin = createAdminClient();

  // 1. Download files from storage
  const fileContents: Array<{ path: string; fileName: string; blob: Blob }> = [];
  const fileStatuses: Array<{
    storagePath: string;
    fileName: string;
    status: "analyzed" | "failed";
    error?: string;
    characters?: number;
  }> = [];

  for (const sp of storagePaths) {
    const fileName = sp.split("/").pop() ?? sp;
    const { data, error } = await admin.storage.from(bucket).download(sp);

    if (error || !data) {
      fileStatuses.push({
        storagePath: sp,
        fileName,
        status: "failed",
        error: `Download failed: ${error?.message ?? "no data"}`,
      });
      continue;
    }
    fileContents.push({ path: sp, fileName, blob: data });
  }

  if (fileContents.length === 0) {
    return NextResponse.json(
      { error: "No files could be downloaded", files: fileStatuses },
      { status: 400 },
    );
  }

  // 2. Extract text via Scrapling
  const scraplingUrl = process.env.SCRAPLING_SERVICE_URL || "http://localhost:8000";
  type ScraplingResult = {
    filename: string;
    text: string | null;
    images: Array<{ page: number | null; index: number; base64: string; type: string }>;
    characters: number;
  };
  const extractions: ScraplingResult[] = [];

  for (const fc of fileContents) {
    try {
      const formData = new FormData();
      formData.append("file", fc.blob, fc.fileName);

      const fetchHeaders: Record<string, string> = {};
      const scraplingToken = process.env.SCRAPLING_AUTH_TOKEN;
      if (scraplingToken) fetchHeaders["Authorization"] = `Bearer ${scraplingToken}`;

      const res = await fetch(`${scraplingUrl}/extract/document`, {
        method: "POST",
        headers: fetchHeaders,
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        fileStatuses.push({
          storagePath: fc.path,
          fileName: fc.fileName,
          status: "failed",
          error: `Scrapling: ${res.status} — ${errText.slice(0, 200)}`,
        });
        continue;
      }

      const result = (await res.json()) as ScraplingResult;
      extractions.push(result);
      fileStatuses.push({
        storagePath: fc.path,
        fileName: fc.fileName,
        status: "analyzed",
        characters: result.characters,
      });
    } catch (err) {
      fileStatuses.push({
        storagePath: fc.path,
        fileName: fc.fileName,
        status: "failed",
        error: err instanceof Error ? err.message : "Unknown extraction error",
      });
    }
  }

  if (extractions.length === 0) {
    return NextResponse.json(
      { error: "No files could be extracted", files: fileStatuses },
      { status: 400 },
    );
  }

  // 3. Call AI for structured analysis
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY not configured", files: fileStatuses },
      { status: 500 },
    );
  }

  const textParts = extractions
    .filter((r) => r.text)
    .map((r) => `--- File: ${r.filename} ---\n${r.text}`)
    .join("\n\n");

  const contentParts: Array<Record<string, unknown>> = [{ type: "text", text: EXTRACTION_PROMPT }];

  // Add images (max 20)
  const allImages = extractions.flatMap((r) => r.images || []).slice(0, 20);
  for (const img of allImages) {
    contentParts.push({
      type: "image_url",
      image_url: { url: `data:image/${img.type};base64,${img.base64}` },
    });
  }

  if (textParts) {
    contentParts.push({
      type: "text",
      text: `\n\n--- DOCUMENTS ---\n\n${textParts.slice(0, 100_000)}`,
    });
  }

  const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openrouterKey}`,
    },
    body: JSON.stringify({
      model: "anthropic/claude-sonnet-4",
      max_tokens: 4096,
      messages: [{ role: "user", content: contentParts }],
    }),
  });

  const aiText = await aiRes.text();

  if (!aiRes.ok) {
    return NextResponse.json(
      { error: "AI analysis failed", debug: aiText.slice(0, 300), files: fileStatuses },
      { status: 502 },
    );
  }

  const aiResponse = JSON.parse(aiText) as {
    choices: Array<{ message: { content: string } }>;
  };

  const textContent = aiResponse.choices?.[0]?.message?.content;
  if (!textContent) {
    return NextResponse.json({ result: {}, files: fileStatuses });
  }

  // Parse JSON from response
  type ExtractionResult = Record<string, unknown>;
  let result: ExtractionResult = {};
  try {
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, textContent];
    result = JSON.parse(jsonMatch[1]!.trim()) as ExtractionResult;
  } catch {
    console.warn("Could not parse AI response as JSON:", textContent.slice(0, 200));
  }

  // 4. Persist extraction log (table not yet in generated types — cast to bypass)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from("document_extraction_log").insert({
    workspace_id: workspaceId,
    storage_paths: storagePaths,
    raw_ai_response: { text: textContent, model: "anthropic/claude-sonnet-4" },
    processed_result: result,
    model: "anthropic/claude-sonnet-4",
  });

  await logPlatformAction(adminId, "documents_analyzed", "workspace", workspaceId, {
    fileCount: storagePaths.length,
    analyzedCount: extractions.length,
  });

  return NextResponse.json({ result, files: fileStatuses });
}

const EXTRACTION_PROMPT = `You are an expert at extracting structured workplace data from Norwegian business documents.

Analyze the provided document text and extract any of the following categories you can find:

1. **policies** — Company policies, rules, guidelines (name + content summary)
2. **payroll** — Tariff agreement info, pay supplements (e.g. evening, weekend, holiday rates)
3. **employees** — Employee names, emails, phone numbers, departments, positions
4. **shiftPatterns** — Shift types with start/end times and departments
5. **employmentTerms** — Notice period, probation period, standard terms
6. **handbookSections** — Content that maps to handbook chapters:
   - identity-mission, organization-model, daily-operations, safety-compliance,
   - communication, onboarding-training, scheduling, quality-service,
   - incident-response, kpi-review

Return ONLY valid JSON matching this schema:
{
  "policies": [{"name": "string", "content": "string", "source": "filename"}],
  "payroll": {"tariff": "string", "supplements": {}, "source": "filename"},
  "employees": [{"firstName": "string", "lastName": "string", "email": "string", "phone": "string", "department": "string", "position": "string", "source": "filename"}],
  "shiftPatterns": [{"name": "string", "startTime": "HH:MM", "endTime": "HH:MM", "department": "string", "source": "filename"}],
  "employmentTerms": {"noticePeriod": "string", "probation": "string", "source": "filename"},
  "handbookSections": [{"chapterKey": "string", "content": "string", "source": "filename"}]
}

Only include categories where you found relevant data. Omit empty arrays/objects.
All text values should be in Norwegian.`;
