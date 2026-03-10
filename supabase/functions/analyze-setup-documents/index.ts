import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * analyze-setup-documents
 *
 * Downloads uploaded documents from Storage, sends them to the Scrapling
 * service for text/image extraction, then sends extracted content to
 * Claude (via OpenRouter) for structured analysis.
 *
 * Body: { workspace_id: string, storage_paths: string[] }
 *
 * Returns: {
 *   result: ExtractionResult,           — merged AI extraction
 *   files: FileStatus[],                — per-file extraction status
 * }
 */

type ExtractionResult = {
  policies?: Array<{ name: string; content: string; source: string }>;
  payroll?: { tariff?: string; supplements?: Record<string, unknown>; source: string };
  employees?: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
    source: string;
  }>;
  shiftPatterns?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    department?: string;
    source: string;
  }>;
  employmentTerms?: { noticePeriod?: string; probation?: string; source: string };
  handbookSections?: Array<{ chapterKey: string; content: string; source: string }>;
};

type FileStatus = {
  storagePath: string;
  fileName: string;
  status: "analyzed" | "failed";
  error?: string;
  characters?: number;
};

type ScraplingResult = {
  filename: string;
  content_type: string;
  text: string | null;
  images: Array<{
    page: number | null;
    index: number;
    base64: string;
    type: string;
    width: number;
    height: number;
  }>;
  pages: number | null;
  characters: number;
  method: string;
};

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

async function extractViaScrapling(fileData: Blob, fileName: string): Promise<ScraplingResult> {
  const scraplingUrl = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";

  const formData = new FormData();
  formData.append("file", fileData, fileName);

  const scraplingToken = Deno.env.get("SCRAPLING_AUTH_TOKEN");
  const fetchHeaders: Record<string, string> = {};
  if (scraplingToken) fetchHeaders["Authorization"] = `Bearer ${scraplingToken}`;

  const res = await fetch(`${scraplingUrl}/extract/document`, {
    method: "POST",
    headers: fetchHeaders,
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Scrapling extraction failed for ${fileName}: ${res.status} — ${errBody}`);
  }

  return (await res.json()) as ScraplingResult;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { workspace_id, storage_paths } = (await req.json()) as {
      workspace_id: string;
      storage_paths: string[];
    };

    if (!workspace_id || !storage_paths?.length) {
      return new Response(JSON.stringify({ error: "workspace_id and storage_paths required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Download files from storage and extract via Scrapling — track per-file status
    const extractionResults: ScraplingResult[] = [];
    const fileStatuses: FileStatus[] = [];

    for (const storagePath of storage_paths) {
      const fileName = storagePath.split("/").pop() ?? storagePath;
      const { data, error } = await supabase.storage.from("setup-documents").download(storagePath);

      if (error || !data) {
        console.warn(`Could not download ${storagePath}:`, error?.message);
        fileStatuses.push({
          storagePath,
          fileName,
          status: "failed",
          error: `Download failed: ${error?.message ?? "no data"}`,
        });
        continue;
      }

      try {
        const result = await extractViaScrapling(data, fileName);
        extractionResults.push(result);
        fileStatuses.push({
          storagePath,
          fileName,
          status: "analyzed",
          characters: result.characters,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown extraction error";
        console.warn(`Extraction failed for ${fileName}:`, msg);
        fileStatuses.push({
          storagePath,
          fileName,
          status: "failed",
          error: msg,
        });
      }
    }

    if (extractionResults.length === 0) {
      return new Response(
        JSON.stringify({ error: "No readable files found", files: fileStatuses }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build text content from extracted documents
    const textParts = extractionResults
      .filter((r) => r.text)
      .map((r) => `--- File: ${r.filename} ---\n${r.text}`)
      .join("\n\n");

    // Call OpenRouter API
    if (!openrouterKey) {
      console.warn("OPENROUTER_API_KEY not set — returning empty extraction");
      return new Response(JSON.stringify({ result: {}, files: fileStatuses }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build multimodal content array
    const contentParts: Array<Record<string, unknown>> = [
      { type: "text", text: EXTRACTION_PROMPT },
    ];

    // Add extracted images as image_url content blocks
    const allImages = extractionResults.flatMap((r) => r.images || []).slice(0, 20);
    for (const img of allImages) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:image/${img.type};base64,${img.base64}`,
        },
      });
    }

    // Add text content
    if (textParts) {
      contentParts.push({
        type: "text",
        text: `\n\n--- DOCUMENTS ---\n\n${textParts.slice(0, 100_000)}`,
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openrouterKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: contentParts,
          },
        ],
      }),
    });

    const responseText = await response.text();
    console.log("OpenRouter status:", response.status);
    console.log("OpenRouter response:", responseText.slice(0, 500));

    if (!response.ok) {
      console.error("OpenRouter API error:", responseText);
      return new Response(
        JSON.stringify({
          error: "AI analysis failed",
          debug: responseText.slice(0, 200),
          files: fileStatuses,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const aiResponse = JSON.parse(responseText) as {
      choices: Array<{ message: { content: string } }>;
    };

    const textContent = aiResponse.choices?.[0]?.message?.content;
    console.log("Parsed textContent:", textContent?.slice(0, 200) ?? "NULL");
    if (!textContent) {
      return new Response(
        JSON.stringify({
          debug: "no textContent",
          raw: responseText.slice(0, 300),
          files: fileStatuses,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse the JSON from the response
    let result: ExtractionResult = {};
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, textContent];
      result = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.warn("Could not parse AI response as JSON:", textContent.slice(0, 200));
    }

    // Persist full AI response + parsed result to database
    const { error: logError } = await supabase.from("document_extraction_log").insert({
      workspace_id,
      storage_paths,
      raw_ai_response: { text: textContent, model: "anthropic/claude-sonnet-4" },
      processed_result: result,
      model: "anthropic/claude-sonnet-4",
    });
    if (logError) {
      console.warn("Failed to persist extraction log:", logError.message);
    }

    return new Response(JSON.stringify({ result, files: fileStatuses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("analyze-setup-documents error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
