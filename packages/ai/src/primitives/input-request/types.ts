/**
 * InputRequest — Generic primitive for Botsson to request typed user input
 *
 * Pattern: Slot filling via UI components / Generative UI / Human-in-the-loop tool inputs.
 *
 * When a Botsson tool needs a piece of structured data (a string, number, date, selection),
 * instead of asking in prose and parsing the user's natural-language reply, the tool returns
 * an InputRequestDescriptor. The runtime forwards the descriptor to the UI, which renders a
 * typed input element. The user types their answer, the typed value goes back to the tool,
 * and the tool resumes with a precise, validated payload.
 *
 * Why this matters for Smartout:
 *   1. PII safety — personnummer + bankkonto NEVER touch STT/TTS or LLM context. They go
 *      directly from the typed input element to the server, encrypted at rest. Botsson
 *      receives only "✓ data registered", never the raw value. This is the foundation for
 *      ADR-0077 (PII handling) and ADR-0078 (channel restriction).
 *   2. Validation at capture time — pattern, min/max, options enforced at the UI layer.
 *      Botsson cannot proceed with malformed data.
 *   3. Auditability — every typed entry has timestamp + user agent. Voice transcripts can
 *      lose digits; typed input cannot.
 *   4. Channel enforcement — InputRequests with sensitivity 'pii' are mechanically refused
 *      over voice channels by the runtime guard.
 *
 * This primitive is generic. Any capability tool (contract, schedule, payroll, etc.) can
 * return an InputRequestDescriptor when it needs typed input.
 */

import { z } from "zod";

// ── Channel enum (mirrors engine_sessions.channel) ──────────────────────────
export const SessionChannelSchema = z.enum([
  "chat",
  "voice",
  "sms",
  "email",
  "telegram",
  "autonomous",
]);
export type SessionChannel = z.infer<typeof SessionChannelSchema>;

// ── Sensitivity tiers ───────────────────────────────────────────────────────
// 'normal' — non-sensitive data (project name, week_start)
// 'pii'    — personal identifiers (personnummer, bankkonto, telephone)
// 'legal'  — contract data with legal weight (salary, employment dates, signatures)
export const SensitivityLevelSchema = z.enum(["normal", "pii", "legal"]);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

// ── Input field types ───────────────────────────────────────────────────────
export const InputFieldTypeSchema = z.enum([
  "text",
  "number",
  "date",
  "tel",
  "email",
  "select",
  "textarea",
]);
export type InputFieldType = z.infer<typeof InputFieldTypeSchema>;

// ── Validation rules ────────────────────────────────────────────────────────
export const InputValidationSchema = z
  .object({
    pattern: z.string().optional(), // regex string for text/tel
    min: z.number().optional(), // numeric or date min
    max: z.number().optional(), // numeric or date max
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).optional(),
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(), // for 'select'
    required: z.boolean().default(true),
  })
  .strict();
export type InputValidation = z.infer<typeof InputValidationSchema>;

// ── The field being requested ───────────────────────────────────────────────
export const InputFieldSchema = z
  .object({
    id: z.string().min(1), // 'personal_number', 'monthly_salary'
    label: z.string().min(1), // 'Personnummer'
    input_type: InputFieldTypeSchema,
    sensitivity: SensitivityLevelSchema.default("normal"),
    placeholder: z.string().optional(),
    helper_text: z.string().optional(), // small hint under the input
    mask: z.string().optional(), // display mask, e.g. '######-#####'
    validation: InputValidationSchema.optional(),
    default_value: z.string().optional(),
  })
  .strict();
export type InputField = z.infer<typeof InputFieldSchema>;

// ── The full InputRequest descriptor that tools return ──────────────────────
export const InputRequestDescriptorSchema = z
  .object({
    type: z.literal("input_request"),
    request_id: z.string().min(1), // tool-generated, used to correlate the response back
    title: z.string().optional(), // optional header above the input ('Sett opp ansatt')
    description: z.string().optional(), // explainer paragraph
    fields: z.array(InputFieldSchema).min(1).max(10), // a request can ask for 1-10 fields at once
    submit_label: z.string().default("Lagre"),
    cancel_label: z.string().default("Avbryt"),
    /**
     * Channel constraint. If the session channel is not in this list, the runtime guard
     * will refuse to render the request and return an error to the tool. PII fields force
     * this to ['chat'] regardless of what the tool sets.
     */
    allowed_channels: z.array(SessionChannelSchema).optional(),
  })
  .strict();
export type InputRequestDescriptor = z.infer<typeof InputRequestDescriptorSchema>;

// ── Type guard for tool runtime ─────────────────────────────────────────────
/**
 * Checks whether a value returned by a tool is an InputRequestDescriptor (vs a plain string
 * or other tool output). The agent runtime calls this on every tool result to decide whether
 * to render an input form or treat the value as final output.
 */
export function isInputRequest(value: unknown): value is InputRequestDescriptor {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return obj.type === "input_request" && typeof obj.request_id === "string";
}

// ── Helper for tools to construct an InputRequest ───────────────────────────
/**
 * Builds an InputRequestDescriptor with sensible defaults. Tools should use this rather
 * than constructing the object manually — it ensures pii fields automatically constrain
 * the channel to chat, and that required defaults are applied.
 */
export function buildInputRequest(params: {
  request_id: string;
  fields: InputField[];
  title?: string;
  description?: string;
  submit_label?: string;
  cancel_label?: string;
  allowed_channels?: SessionChannel[];
}): InputRequestDescriptor {
  const hasPiiField = params.fields.some((f) => f.sensitivity === "pii");

  // PII fields force chat-only regardless of caller intent. Defense in depth.
  const allowed_channels: SessionChannel[] = hasPiiField
    ? ["chat"]
    : (params.allowed_channels ?? ["chat", "voice", "sms", "email", "telegram", "autonomous"]);

  return {
    type: "input_request",
    request_id: params.request_id,
    title: params.title,
    description: params.description,
    fields: params.fields,
    submit_label: params.submit_label ?? "Lagre",
    cancel_label: params.cancel_label ?? "Avbryt",
    allowed_channels,
  };
}
