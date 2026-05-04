/**
 * NonEmptyString — branded string that is guaranteed non-empty at construction.
 * ADR-0193 (amendment to ADR-0134). Closes the actor_id/workspace_id empty-string
 * fallback class of telemetry-corruption bugs (L-0038/0045/0094/0103).
 */
export type NonEmptyString = string & { readonly __brand: unique symbol };

/**
 * Dev/test: throws loudly — caught by Vitest + local dev runs.
 * Prod: returns sentinel; downstream providers (activity_trail, engine_event)
 * reject the sentinel with a structured console.warn.
 */
export function nonEmpty(s: string | null | undefined, field: string): NonEmptyString {
  if (s === null || s === undefined || s === "") {
    const env = process.env.NODE_ENV;
    if (env === "development" || env === "test") {
      throw new Error(`telemetry: ${field} must be non-empty (got ${JSON.stringify(s)})`);
    }
    console.warn(`[telemetry] dropping event: ${field} is empty`);
    return "__EMIT_DROPPED__" as NonEmptyString;
  }
  return s as NonEmptyString;
}
