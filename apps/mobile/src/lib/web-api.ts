/**
 * Web BFF endpoint configuration (ADR-0132 — mobile thin client).
 *
 * Mobile AI/capability traffic routes through the web BFF (`/api/emma/chat`)
 * which proxies to stage-engine. Mobile NEVER calls capabilities directly.
 *
 * Configuration:
 * - Set `EXPO_PUBLIC_WEB_API_URL` in `.env` (or `.env.template` via `op run`).
 * - Dev defaults to `http://localhost:3060` (iOS sim).
 * - For Android emulator: set `EXPO_PUBLIC_WEB_API_URL=http://10.0.2.2:3060`.
 * - For physical-device dev: set to your host machine's LAN IP.
 * - Production: set to `https://app.smartout.ai` (or current prod domain).
 *
 * In PWA mode (web bundle), same-origin relative URLs would also work, but
 * we keep the absolute path for consistency with native and to make the
 * BFF→stage-engine hop explicit per ADR-0132.
 */

const DEFAULT_DEV_URL = "http://localhost:3060";

/**
 * Returns the absolute base URL for the web BFF.
 * Used for AI/capability calls per ADR-0132.
 */
export function getWebApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_WEB_API_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    // In prod we expect EXPO_PUBLIC_WEB_API_URL to be set — failing fast
    // is better than silently hitting localhost from a shipped binary.
    throw new Error(
      "EXPO_PUBLIC_WEB_API_URL is required in production. " +
        "Set it in eas.json or your env config.",
    );
  }
  return DEFAULT_DEV_URL;
}

/** Absolute URL for the employee-facing AI chat endpoint. */
export function getEmmaChatUrl(): string {
  return `${getWebApiUrl()}/api/emma/chat`;
}

/** Absolute URL for the guided-journey BFF start endpoint (ADR-0132). */
export function getJourneyGuidedStartUrl(): string {
  return `${getWebApiUrl()}/api/journey/guided/start`;
}

/** Absolute URL for the guided-journey BFF status endpoint (ADR-0132). */
export function getJourneyGuidedStatusUrl(runId: string): string {
  return `${getWebApiUrl()}/api/journey/guided/${runId}/status`;
}
