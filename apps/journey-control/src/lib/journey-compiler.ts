/**
 * journey-compiler.ts
 *
 * Markdown → JourneyIR compiler via OpenRouter (Claude Sonnet 4.6).
 *
 * Reads a JOURNEY-X.md narrative, sends it to the LLM with the JourneyIR v2
 * schema as a system prompt, and expects a single JSON object back.
 * Validates the response against JourneyIRSchema and returns a discriminated
 * CompileResult union.
 *
 * Provider: OpenRouter via OpenAI SDK (not direct Anthropic SDK).
 * Why: Pontus's API key is OpenRouter. L-0202: Anthropic top-level `system`
 * field is silently dropped on OpenRouter OpenAI-compat endpoint — system
 * prompt must go as messages[0] with role:"system". response_format json_object
 * forces JSON output; without it Claude returns prose + JSON → JSON.parse fails.
 *
 * Caller (API route) is responsible for writing the resulting IR to
 * apps/e2e/protocols/ via ir-ts-emitter.
 */

import OpenAI from "openai";
import { JourneyIRSchema, type JourneyIR } from "@smartout/journey-ir";

export type CompileInput = {
  markdown: string;
  apiKey: string;
  desiredSlug?: string;
};

export type CompileResult =
  | { ok: true; ir: JourneyIR; rawText: string }
  | { ok: false; error: string };

// System prompt encodes the JourneyIR v2 schema verbatim so the model
// knows exactly what shape to emit. Passed as messages[0] (L-0202).
const SYSTEM_PROMPT = `You are a JourneyIR compiler. Given a markdown narrative describing a user journey, return a single JSON object that strictly matches the JourneyIR v2.0.0 schema.

REQUIRED top-level fields:
- version: "2.0.0"
- slug: short uppercase-kebab id (e.g. "P-002")
- title: short human title
- module: lowercase-kebab module slug
- steps: array of journey steps

Each step REQUIRES:
- key: snake_case_id
- order: 1-indexed integer
- title: human title
- action: short narrative description
- assertion: short narrative of expected outcome
- actions: array of typed runner actions: navigate/fill/click/click_text/wait_visible/wait_hidden/settle
- gate: ONE of db_record / ui_state / url_match / telemetry_event

OPTIONAL top-level: actor, platform, auth_profile, entry_url, success_gate, preconditions, speed_profile.

OPTIONAL per-step: timeoutMs, screenshot, description.

Action shapes:
- navigate: { type: "navigate", url: string }
- fill: { type: "fill", testid: string, value: string }
- click: { type: "click", testid: string }
- click_text: { type: "click_text", text: string }
- wait_visible: { type: "wait_visible", testid: string }
- wait_hidden: { type: "wait_hidden", testid: string }
- settle: { type: "settle", ms: number }

Gate shapes:
- url_match: { type: "url_match", pattern: string, timeout_ms?: number }
- ui_state: { type: "ui_state", testid: string, visible?: boolean, timeout_ms?: number }
- db_record: { type: "db_record", table: string, where: object, expect: object, timeout_ms?: number }
- telemetry_event: { type: "telemetry_event", event_name: string, timeout_ms?: number }

Output ONLY the JSON object. No commentary, no code fences, no explanation.`;

export async function compileMarkdownToIR(input: CompileInput): Promise<CompileResult> {
  // OpenRouter via OpenAI-compat SDK.
  // defaultHeaders identify the referrer for OpenRouter analytics.
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3065",
      "X-Title": "Journey Control Center",
    },
  });

  const userPrompt = input.desiredSlug
    ? `Use slug "${input.desiredSlug}".\n\nMarkdown:\n\n${input.markdown}`
    : `Markdown:\n\n${input.markdown}`;

  let response: Awaited<ReturnType<typeof client.chat.completions.create>>;
  try {
    response = await client.chat.completions.create({
      // L-0202: model slug verified against OpenRouter model list.
      // anthropic/claude-sonnet-4-6 is the canonical slug as of 2026-05.
      model: "anthropic/claude-sonnet-4-6",
      // response_format forces JSON output — without it Claude returns prose + JSON.
      response_format: { type: "json_object" },
      max_tokens: 8192,
      messages: [
        // L-0202: system field must be messages[0] on OpenRouter compat endpoint.
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (err) {
    return {
      ok: false,
      error: `OpenRouter API error: ${(err as Error).message}`,
    };
  }

  const rawText = response.choices[0]?.message?.content ?? "";
  if (!rawText) {
    return { ok: false, error: "No content in OpenRouter response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: `LLM returned invalid JSON: ${rawText.slice(0, 200)}`,
    };
  }

  const validation = JourneyIRSchema.safeParse(parsed);
  if (!validation.success) {
    return {
      ok: false,
      error: `IR schema validation failed: ${validation.error.issues
        .map((i) => i.path.join(".") + ": " + i.message)
        .join("; ")}`,
    };
  }

  return { ok: true, ir: validation.data, rawText };
}
