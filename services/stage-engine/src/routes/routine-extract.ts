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
// heic-convert ships no types — pure-JS libheif wasm, safe in node (no native deps).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no type declarations
import heicConvert from "heic-convert";
import { DraftSchema, type RoutineDraft } from "@smartout/ai/capabilities/routine/draft-schema";
import { getSecrets } from "../secrets.js";

const VISION_MODEL = "anthropic/claude-sonnet-4.6";

// Anthropic vision accepts jpeg/png/gif/webp — NOT heic/heif (iPhone default).
// We download the image, transcode HEIC→JPEG, and inline it as base64 so the
// model never has to fetch (also sidesteps private/localhost-URL rejection).
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function isHeic(bytes: Uint8Array, contentType: string): boolean {
  if (/hei[cf]|heif/i.test(contentType)) return true;
  // ISO-BMFF: bytes 4..8 = "ftyp", brand at 8..12 (heic/heix/mif1/msf1/heif…).
  if (bytes.length < 12) return false;
  const ftyp = String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!);
  if (ftyp !== "ftyp") return false;
  const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
  return /^(hei|hev|mif|msf)/.test(brand);
}

/** Download an image URL, transcode HEIC→JPEG, return a base64 data URL the model can read. */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image_fetch_failed: ${res.status}`);
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  let bytes = new Uint8Array(await res.arrayBuffer());
  let mediaType = contentType.split(";")[0]?.trim() ?? "";

  if (isHeic(bytes, contentType)) {
    const jpg: ArrayBuffer | Buffer = await heicConvert({
      buffer: Buffer.from(bytes),
      format: "JPEG",
      quality: 0.85,
    });
    bytes = new Uint8Array(jpg as ArrayBuffer);
    mediaType = "image/jpeg";
  } else if (!SUPPORTED_IMAGE_TYPES.includes(mediaType)) {
    // Unknown/missing content-type — default to jpeg (covers signed-URL responses
    // that omit a precise type). If it's truly unsupported the model will reject.
    mediaType = "image/jpeg";
  }

  return `data:${mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

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
  const dataUrl = await fetchImageAsDataUrl(imageUrl);
  const { text } = await generateText({
    model: getOpenRouter()(VISION_MODEL),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: EXTRACT_PROMPT },
          { type: "image", image: new URL(dataUrl) },
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
