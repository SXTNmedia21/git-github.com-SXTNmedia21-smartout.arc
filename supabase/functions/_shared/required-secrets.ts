/**
 * requireSecrets — module-eval secret validation for Edge Functions.
 *
 * Call at top of an Edge Function index.ts (BEFORE Deno.serve) with the list
 * of env vars the function needs to run. If any is missing or empty, throws
 * a descriptive error that causes the worker to fail bootstrap → the
 * runtime returns BOOT_ERROR / InvalidWorkerCreation → edge-functions-boot-check.sh
 * catches it AT STARTUP rather than as a runtime 401/500 after a user action.
 *
 * Per Pontus 2026-05-19: "MUST BE ALEARTED ON STARTUP. THIS CAN NEVER
 * HAPPEND IN RUNTIME". This couples each EF to its required secrets so a
 * misconfigured edge-runtime container fails loud and early.
 *
 * Usage:
 *   import { requireSecrets } from "../_shared/required-secrets.ts";
 *
 *   requireSecrets("my-edge-function", [
 *     "OPENROUTER_API_KEY",
 *     "STAGE_ENGINE_API_KEY",
 *   ]);
 *
 * What is NOT a "required secret":
 *   - Anon key, service role key, SUPABASE_URL — provided by the runtime
 *     itself (always present). Listing them adds noise.
 *   - Optional integrations (e.g. SENTRY_DSN) — handle with a runtime
 *     fallback inside the handler, not a boot guard.
 *
 * What IS a required secret:
 *   - Bearer tokens for downstream services (SCRAPLING_AUTH_TOKEN, etc.)
 *   - API keys for external providers (OPENROUTER_API_KEY, OPENAI_API_KEY)
 *   - Webhook signing secrets (DOCUSEAL_WEBHOOK_SECRET, STRIPE_WEBHOOK_SECRET)
 *
 * Anything where a missing value would cause a 4xx/5xx mid-flight that the
 * user would experience as silent failure or generic error.
 */
export function requireSecrets(functionName: string, keys: readonly string[]): void {
  const missing: string[] = [];
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value === undefined || value === "") {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const list = missing.join(", ");
    // Throw at module-eval — worker will not boot. edge-functions-boot-check.sh
    // catches this as BOOT_ERROR and surfaces it during dev startup.
    throw new Error(
      `[${functionName}] BOOT_ERROR: missing required env vars: ${list}. ` +
        `Check supabase/config.toml [edge_runtime.secrets] and ensure the host ` +
        `shell has these set (typically via 'op run --env-file=.env.template -- ` +
        `npx supabase start'). Function refuses to boot rather than fail silently ` +
        `at runtime.`,
    );
  }
}
