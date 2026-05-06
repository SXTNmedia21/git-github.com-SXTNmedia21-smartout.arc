/**
 * instrumentation.ts — Sentry init (optional Phase 1)
 *
 * Next.js instrumentation hook called once at server startup.
 * Mirrors apps/landing pattern.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
