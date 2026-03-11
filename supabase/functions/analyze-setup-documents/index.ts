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

type ScraplingBatchResult = {
  results: ScraplingResult[];
  total_characters: number;
  total_images: number;
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

function getScraplingConfig() {
  const url = Deno.env.get("SCRAPLING_SERVICE_URL");
  const token = Deno.env.get("SCRAPLING_AUTH_TOKEN");

  if (!url) {
    console.error("SCRAPLING_SERVICE_URL not set — cannot reach Scrapling service");
  }

  return { url: url || "http://host.docker.internal:8000", token };
}

async function extractViaBatch(
  files: Array<{ data: Blob; fileName: string }>,
  config: { url: string; token?: string },
): Promise<{ results: ScraplingResult[]; errors: Array<{ fileName: string; error: string }> }> {
  const formData = new FormData();
  for (const f of files) {
    formData.append("files", f.data, f.fileName);
  }

  const headers: Record<string, string> = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

  try {
    const res = await fetch(`${config.url}/extract/document/batch`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });

    if (res.status === 401) {
      throw new Error(
        "Scrapling auth failed — check SCRAPLING_AUTH_TOKEN secret matches the service",
      );
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Scrapling batch extraction failed: ${res.status} — ${errBody}`);
    }

    const batch = (await res.json()) as ScraplingBatchResult;
    return { results: batch.results, errors: [] };
  } finally {
    clearTimeout(timeout);
  }
}

async function extractViaScrapling(
  fileData: Blob,
  fileName: string,
  config: { url: string; token?: string },
): Promise<ScraplingResult> {
  const formData = new FormData();
  formData.append("file", fileData, fileName);

  const headers: Record<string, string> = {};
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000); // 1 min timeout per file

  try {
    const res = await fetch(`${config.url}/extract/document`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });

    if (res.status === 401) {
      throw new Error("Scrapling auth failed — check SCRAPLING_AUTH_TOKEN secret");
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Scrapling ${res.status}: ${errBody}`);
    }

    return (await res.json()) as ScraplingResult;
  } finally {
    clearTimeout(timeout);
  }
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
    const scraplingConfig = getScraplingConfig();

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Step 1: Download files from Storage ──

    const downloadedFiles: Array<{ data: Blob; fileName: string; storagePath: string }> = [];
    const fileStatuses: FileStatus[] = [];

    for (const storagePath of storage_paths) {
      const fileName = storagePath.split("/").pop() ?? storagePath;
      const { data, error } = await supabase.storage.from("setup-documents").download(storagePath);

      if (error || !data) {
        console.warn(`Storage download failed for ${storagePath}:`, error?.message);
        fileStatuses.push({
          storagePath,
          fileName,
          status: "failed",
          error: `Nedlasting feilet: ${error?.message ?? "ingen data"}`,
        });
        continue;
      }

      downloadedFiles.push({ data, fileName, storagePath });
    }

    if (downloadedFiles.length === 0) {
      return new Response(
        JSON.stringify({
          result: {},
          error: "Ingen filer kunne lastes ned fra lagring",
          errorCode: "STORAGE_DOWNLOAD_FAILED",
          files: fileStatuses,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Step 2: Extract text via Scrapling ──

    const extractionResults: ScraplingResult[] = [];

    // Try batch endpoint first (single HTTP call), fall back to per-file
    try {
      const batch = await extractViaBatch(downloadedFiles, scraplingConfig);

      // Match results back to files by filename
      for (const downloaded of downloadedFiles) {
        const match = batch.results.find((r) => r.filename === downloaded.fileName);
        if (match && !("error" in match)) {
          extractionResults.push(match);
          fileStatuses.push({
            storagePath: downloaded.storagePath,
            fileName: downloaded.fileName,
            status: "analyzed",
            characters: match.characters,
          });
        } else {
          const errMsg =
            match && "error" in match
              ? String((match as Record<string, unknown>).error)
              : "Ingen resultat fra Scrapling";
          fileStatuses.push({
            storagePath: downloaded.storagePath,
            fileName: downloaded.fileName,
            status: "failed",
            error: errMsg,
          });
        }
      }
    } catch (batchErr) {
      // Batch failed — fall back to per-file extraction
      const batchMsg = batchErr instanceof Error ? batchErr.message : "Unknown batch error";
      console.warn(`Batch extraction failed, falling back to per-file: ${batchMsg}`);

      for (const downloaded of downloadedFiles) {
        try {
          const result = await extractViaScrapling(
            downloaded.data,
            downloaded.fileName,
            scraplingConfig,
          );
          extractionResults.push(result);
          fileStatuses.push({
            storagePath: downloaded.storagePath,
            fileName: downloaded.fileName,
            status: "analyzed",
            characters: result.characters,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Ukjent feil";
          console.warn(`Extraction failed for ${downloaded.fileName}:`, msg);
          fileStatuses.push({
            storagePath: downloaded.storagePath,
            fileName: downloaded.fileName,
            status: "failed",
            error: msg,
          });
        }
      }
    }

    if (extractionResults.length === 0) {
      // Determine if this is an auth issue (all files failed with auth error)
      const authFailed = fileStatuses.some((f) => f.error?.includes("auth failed"));
      const errorCode = authFailed ? "SCRAPLING_AUTH_FAILED" : "SCRAPLING_EXTRACTION_FAILED";
      const errorMsg = authFailed
        ? "Scrapling-tjenesten avviste forespørselen (autentisering feilet)"
        : "Ingen filer kunne ekstraheres — Scrapling-tjenesten er utilgjengelig eller filene er uleselige";

      return new Response(
        JSON.stringify({ result: {}, error: errorMsg, errorCode, files: fileStatuses }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── Step 3: AI analysis via OpenRouter ──

    // Build text content from extracted documents
    const textParts = extractionResults
      .filter((r) => r.text)
      .map((r) => `--- File: ${r.filename} ---\n${r.text}`)
      .join("\n\n");

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
          result: {},
          error: "AI-analyse feilet",
          errorCode: "AI_ANALYSIS_FAILED",
          files: fileStatuses,
        }),
        {
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
      JSON.stringify({
        error: err instanceof Error ? err.message : "Ukjent feil",
        errorCode: "INTERNAL_ERROR",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
