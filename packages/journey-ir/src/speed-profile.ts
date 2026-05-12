/**
 * Speed profile primitive for JourneyIR runner.
 *
 * Three named profiles, each maps to multipliers applied to the runner's
 * default delays and timeouts. The IR optionally pins one (`speed_profile`
 * field), and the runtime can override via env var (resolved in the runner,
 * not here — this module is pure).
 *
 * Multipliers are conservative — they SLOW the runner down. They never
 * speed it up below current defaults (which are CI-tuned).
 */

export type SpeedProfile = "full" | "normal" | "ai_companion";

export type SpeedMultiplier = {
  /** Multiplier for `RUNNER_CONFIG.settleDelay` between actions. */
  settle: number;
  /** Multiplier for gate retry intervals (db_record, ui_state, etc.). */
  retry: number;
  /** Multiplier for gate timeouts (so slower runs don't false-fail). */
  timeout: number;
};

export const SPEED_PROFILES: Record<SpeedProfile, SpeedMultiplier> = {
  full: { settle: 1, retry: 1, timeout: 1 },
  normal: { settle: 3, retry: 3, timeout: 2 },
  ai_companion: { settle: 8, retry: 6, timeout: 3 },
};

export function resolveSpeedMultiplier(profile: SpeedProfile | undefined): SpeedMultiplier {
  return SPEED_PROFILES[profile ?? "full"];
}
