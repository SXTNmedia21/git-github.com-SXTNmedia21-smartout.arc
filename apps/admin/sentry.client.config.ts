/**
 * sentry.client.config.ts — Sentry client-side init
 *
 * Shape copied from apps/landing. Active when NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
