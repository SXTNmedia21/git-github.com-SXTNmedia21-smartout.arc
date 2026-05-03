/**
 * sentry.server.config.ts — Sentry server-side init
 *
 * Shape copied from apps/landing. Active when SENTRY_DSN is set.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
