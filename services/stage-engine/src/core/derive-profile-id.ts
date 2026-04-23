import type { SupabaseClient } from "@supabase/supabase-js";
import { nonEmpty, type NonEmptyString } from "@smartout/telemetry/server";

export class ActorDerivationError extends Error {
  constructor(
    message: string,
    public readonly userId: string,
    public readonly workspaceId: string,
  ) {
    super(message);
    this.name = "ActorDerivationError";
  }
}

/**
 * Server-side profile_id derivation. ADR-0151.
 *
 * Replaces body-trust pattern (forgeable by API-key callers).
 * Returns NonEmptyString per ADR-0193.
 * Throws ActorDerivationError for zero rows, branding failure, or DB error.
 */
export async function deriveProfileId(
  userId: string,
  workspaceId: string,
  supabase: SupabaseClient,
): Promise<NonEmptyString> {
  const { data, error } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new ActorDerivationError(`profile lookup failed: ${error.message}`, userId, workspaceId);
  }
  if (!data || !data.profile_id) {
    throw new ActorDerivationError(`no profile row for user in workspace`, userId, workspaceId);
  }

  try {
    return nonEmpty(data.profile_id, "profile_id");
  } catch (err) {
    throw new ActorDerivationError(
      `profile_id brand failure: ${(err as Error).message}`,
      userId,
      workspaceId,
    );
  }
}
