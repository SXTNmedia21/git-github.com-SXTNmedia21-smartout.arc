/**
 * routine-extract.ts
 * POST /routine/extract — vision model extracts a structured routine draft from an image URL.
 * Read-only: never touches DB. Uses generateObject so the response is schema-validated at call site.
 */
import { Hono } from "hono";
import { z } from "zod";
import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { DraftSchema, type RoutineDraft } from "@smartout/ai/capabilities/routine/draft-schema";
import { getSecrets } from "../secrets.js";

const VISION_MODEL = "anthropic/claude-sonnet-4.6";

const EXTRACT_PROMPT =
  "Du er en operativ assistent. Bildet viser en sjekkliste eller rutine fra en " +
  "arbeidsplass (f.eks. åpnings- eller stengeoppgaver). Trekk ut en strukturert " +
  "rutine: et beskrivende navn, et trigger-gjett (scheduled for tidsbaserte " +
  "åpning/stenging, event ellers), et valgfritt lokasjonshint hvis bildet nevner " +
  "et sted, og hvert punkt som et steg med tittel + kort beskrivelse. Norsk.";

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
function getOpenRouter() {
  if (!_openrouter) {
    const apiKey = getSecrets().openrouterApiKey;
    if (!apiKey) throw new Error("OpenRouter API key not available");
    _openrouter = createOpenRouter({ apiKey });
  }
  return _openrouter;
}

export async function extractRoutineFromImage(imageUrl: string): Promise<RoutineDraft> {
  const { object } = await generateObject({
    model: getOpenRouter()(VISION_MODEL),
    schema: DraftSchema,
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
  return DraftSchema.parse(object);
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
