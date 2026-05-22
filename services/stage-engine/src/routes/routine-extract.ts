/**
 * routine-extract.ts
 * POST /routine/extract — vision model extracts a structured routine draft from an image URL.
 * Read-only: never touches DB.
 *
 * Uses generateText (NOT generateObject): the vision model is routed via OpenRouter,
 * and the json_schema/structured-output mode of generateObject is rejected by some
 * upstream providers (e.g. Amazon Bedrock) when combined with an image content block
 * ("Provider returned error"). Plain completion + explicit JSON instruction + a
 * DraftSchema.parse at the call site is provider-robust and equally validated.
 */
import { Hono } from "hono";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DraftSchema, type RoutineDraft } from "@smartout/ai/capabilities/routine/draft-schema";
import { getSecrets } from "../secrets.js";

const VISION_MODEL = "anthropic/claude-sonnet-4.6";

const EXTRACT_PROMPT =
  "Du er en operativ assistent. Bildet viser en sjekkliste eller rutine fra en " +
  "arbeidsplass (f.eks. åpnings- eller stengeoppgaver). Trekk ut en strukturert " +
  "rutine fra bildet.\n\n" +
  "Svar KUN med gyldig JSON (ingen markdown, ingen forklaring) som matcher nøyaktig:\n" +
  '{"routine_name": string, "trigger_guess": {"trigger_type": "scheduled" | "event", ' +
  '"trigger_config": object}, "location_hint": string | null, "steps": ' +
  '[{"title": string, "description": string, "is_required": boolean, ' +
  '"estimated_minutes": number | null}]}\n\n' +
  "trigger_type='scheduled' for tidsbaserte rutiner (åpning/stenging), 'event' ellers. " +
  "location_hint = stedsnavn hvis bildet nevner et sted, ellers null. " +
  "Hvert punkt på lista blir ett steg. Norsk tekst i feltene.";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
function getOpenRouter() {
  if (!_openrouter) {
    const apiKey = getSecrets().openrouterApiKey;
    if (!apiKey) throw new Error("OpenRouter API key not available");
    _openrouter = createOpenRouter({ apiKey });
  }
  return _openrouter;
}

/** Strip ```json ... ``` fences a model may wrap JSON in, then return the inner payload. */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fence ? fence[1]! : trimmed).trim();
}

export async function extractRoutineFromImage(imageUrl: string): Promise<RoutineDraft> {
  const { text } = await generateText({
    model: getOpenRouter()(VISION_MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image", image: new URL(imageUrl) },
        ],
      },
    ],
  });
  const parsed: unknown = JSON.parse(stripJsonFences(text));
  return DraftSchema.parse(parsed);
}

const BodySchema = z.object({ image_url: z.string().url() }).strict();

export const routineExtractRoute = new Hono();

routineExtractRoute.post("/routine/extract", async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ ok: false, error: "invalid_body" }, 422);
  }
  try {
    const draft = await extractRoutineFromImage(parsed.data.image_url);
    return c.json({ ok: true, draft }, 200);
  } catch (err) {
    return c.json({ ok: false, error: `extract_failed: ${(err as Error).message}` }, 500);
  }
});
