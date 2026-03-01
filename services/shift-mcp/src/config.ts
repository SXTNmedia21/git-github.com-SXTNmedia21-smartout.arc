// ============================================
// config.ts
// Validates all environment variables at startup using Zod.
// If any required variable is missing or invalid, the process
// crashes immediately with a clear error message.
// Connected to: .env.example (documents all variables)
// ============================================

import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(32),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
