import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * analyze-setup-documents
 *
 * Reads uploaded documents from Storage, sends text content to Anthropic Claude
 * for structured extraction, and returns a DocumentExtractionResult.
 *
 * Body: { workspace_id: string, storage_paths: string[] }
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

async function readFileContent(
  supabase: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<{ text: string; fileName: string } | null> {
  const fileName = storagePath.split("/").pop() ?? storagePath;

  const { data, error } = await supabase.storage.from("setup-documents").download(storagePath);

  if (error || !data) {
    console.warn(`Could not download ${storagePath}:`, error?.message);
    return null;
  }

  // For text-based files, read as text
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["txt", "csv"].includes(ext ?? "")) {
    return { text: await data.text(), fileName };
  }

  // For PDFs, we send as base64 to the model (multimodal)
  if (ext === "pdf") {
    const bytes = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return {
      text: `[PDF base64 content: ${base64.slice(0, 100)}... (${bytes.byteLength} bytes)]`,
      fileName,
    };
  }

  // For images, encode as base64
  if (["jpg", "jpeg", "png", "webp"].includes(ext ?? "")) {
    const bytes = await data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
    return {
      text: `[Image base64: ${base64.slice(0, 100)}... (${bytes.byteLength} bytes)]`,
      fileName,
    };
  }

  // DOCX/XLSX — extract as raw text (limited without a parser)
  return { text: await data.text(), fileName };
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Read all file contents
    const fileContents: Array<{ text: string; fileName: string }> = [];
    for (const path of storage_paths) {
      const content = await readFileContent(supabase, path);
      if (content) fileContents.push(content);
    }

    if (fileContents.length === 0) {
      return new Response(JSON.stringify({ error: "No readable files found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the document text for the prompt
    const documentText = fileContents
      .map((f) => `--- File: ${f.fileName} ---\n${f.text}`)
      .join("\n\n");

    // Call Anthropic Claude API
    if (!anthropicKey) {
      // Fallback: return empty result if no API key configured
      console.warn("ANTHROPIC_API_KEY not set — returning empty extraction");
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n--- DOCUMENTS ---\n\n${documentText.slice(0, 100_000)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const textBlock = aiResponse.content.find((b) => b.type === "text");
    if (!textBlock?.text) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the JSON from the response
    let result: ExtractionResult = {};
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = textBlock.text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [
        null,
        textBlock.text,
      ];
      result = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.warn("Could not parse AI response as JSON:", textBlock.text.slice(0, 200));
    }

    return new Response(JSON.stringify(result), {
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
