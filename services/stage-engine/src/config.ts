// ============================================
// config.ts
// Validates all environment variables at startup using Zod.
// If any required variable is missing or invalid, the process
// crashes immediately with a clear error message.
// Connected to: .env.example (documents all variables)
// ============================================

import { z } from "zod";

const envSchema = z.object({
  /** Server port — defaults to 5010 */
  PORT: z.coerce.number().default(5010),

  /** Public URL of the engine — used in webhook payloads and Ultravox tool URLs */
  ENGINE_URL: z.string().url(),

  /** Supabase project URL */
  SUPABASE_URL: z.string().url(),

  /** Supabase anonymous key — used for JWT-authenticated requests */
  SUPABASE_ANON_KEY: z.string().min(32),

  /** Supabase service role key — used for admin operations (key validation, context loading) */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),

  // ULTRAVOX_API_KEY and OPENROUTER_API_KEY are loaded from Vault at runtime.
  // See src/secrets.ts — only SUPABASE_URL + SERVICE_ROLE_KEY needed as env vars.

  /** Dev-only API key — bypasses platform_api_key DB lookup in local dev */
  DEV_API_KEY: z.string().optional(),

  /** Log level */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** How long sessions last before auto-expiry (hours) */
  SESSION_EXPIRY_HOURS: z.coerce.number().default(24),

  /** How often to run the session cleanup job (minutes) */
  CLEANUP_INTERVAL_MINUTES: z.coerce.number().default(5),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
