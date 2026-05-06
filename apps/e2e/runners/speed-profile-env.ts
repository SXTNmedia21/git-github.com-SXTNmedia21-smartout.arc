// apps/e2e/runners/speed-profile-env.ts
/**
 * Runtime speed-profile resolver for the protocol runner.
 *
 * Precedence: env var > IR field > "full".
 * Invalid env values are ignored (fall through to IR).
 */

import type { SpeedProfile } from "@smartout/journey-ir";

const VALID: ReadonlySet<SpeedProfile> = new Set(["full", "normal", "ai_companion"]);

export function resolveRuntimeSpeedProfile(irProfile: SpeedProfile | undefined): SpeedProfile {
  const envRaw = process.env.JOURNEY_SPEED_PROFILE;
  if (envRaw && VALID.has(envRaw as SpeedProfile)) {
    return envRaw as SpeedProfile;
  }
  return irProfile ?? "full";
}
