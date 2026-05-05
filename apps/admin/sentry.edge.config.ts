/**
 * sentry.edge.config.ts — Sentry edge runtime init
 *
 * Shape copied from apps/landing. Active for edge route handlers.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  debug: false,
});
