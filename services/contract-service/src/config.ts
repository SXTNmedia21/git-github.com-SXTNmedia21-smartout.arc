import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(5012),
  SERVICE_KEY: z.string().min(16),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(32),

  // DOCUSEAL secrets: loaded from Vault at runtime (preferred), with env var fallback.
  // See src/secrets.ts for the loading logic.
  DOCUSEAL_API_KEY: z.string().min(1).optional(),
  DOCUSEAL_WEBHOOK_SECRET: z.string().min(1).optional(),
  DOCUSEAL_API_URL: z.string().url().default("https://api.docuseal.com"),

  SMARTOUT_COMPANY_NAME: z.string().default("Smartout AS"),
  SMARTOUT_ORG_NUMBER: z.string().default(""),
  SMARTOUT_CONTACT_EMAIL: z.string().email().default("pontus@smartout.io"),
  APP_URL: z.string().url().default("http://localhost:3050"),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;
