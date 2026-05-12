import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    SENDGRID_API_KEY: z.string().optional(),
    SMTP_DEV_HOST: z
      .string()
      .regex(/^[^:]+:\d+$/)
      .optional(),
    TWILIO_ACCOUNT_SID: z.string().optional(),
    TWILIO_AUTH_TOKEN: z.string().optional(),
    JWT_SECRET: z.string().min(32).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    GITHUB_ERROR_TOKEN: z.string().optional(),
    GITHUB_ERROR_REPO: z.string().optional(),
    DOCUSEAL_WEBHOOK_SECRET: z.string().min(16),
    CONTRACT_SERVICE_URL: z.string().url().optional(),
    CONTRACT_SERVICE_KEY: z.string().min(16).optional(),
    // SMA-307: dev-only walt stub gate — NEVER "true" in production
    CONTRACT_SERVICE_DEV_FALLBACK: z.enum(["true", "false"]).optional(),
    // Local sign-stub — bypass DocuSeal on localhost. NEVER "true" in production.
    CONTRACT_LOCAL_SIGN_MODE: z.enum(["true", "false"]).optional(),
    SCRAPLING_SERVICE_URL: z.string().url().optional(),
    SCRAPLING_AUTH_TOKEN: z.string().min(1).optional(),
    SERPER_API_KEY: z.string().min(1).optional(),
    GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
    SHIFT_MCP_URL: z.string().url().optional(),
    STAGE_ENGINE_URL: z.string().url().optional(),
    STAGE_ENGINE_API_KEY: z.string().min(16).optional(),
    LIVEKIT_API_KEY: z.string().min(1).optional(),
    LIVEKIT_API_SECRET: z.string().min(1).optional(),
    LIVEKIT_WEBHOOK_SECRET: z.string().min(1).optional(),
    // Allow overriding Node environment for testing
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },

  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://eu.i.posthog.com"),
    NEXT_PUBLIC_POSTHOG_PROJECT_ID: z.string().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("localhost"),
    NEXT_PUBLIC_LANDING_URL: z.string().url().optional(),
    NEXT_PUBLIC_REVALIDATION_SECRET: z.string().optional(),
    NEXT_PUBLIC_STAGE_ENGINE_URL: z.string().url().optional(),
    NEXT_PUBLIC_LIVEKIT_URL: z.string().url().optional(),
  },

  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_PROJECT_ID: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_LANDING_URL: process.env.NEXT_PUBLIC_LANDING_URL,
    NEXT_PUBLIC_REVALIDATION_SECRET: process.env.NEXT_PUBLIC_REVALIDATION_SECRET,
    NEXT_PUBLIC_STAGE_ENGINE_URL: process.env.NEXT_PUBLIC_STAGE_ENGINE_URL,
    NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
  },

  // If variables are missing, it will throw an error automatically
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
