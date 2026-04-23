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

/**
 * Absolute URL for the M2 reconciliation wizard admin-override BFF
 * endpoint (closure Item 4 / ADR-0132). Mobile never persists an override
 * directly — the BFF re-derives identity server-side (ADR-0176 Invariant 3),
 * gates on `signoff.admin_override`, then mirrors the web Server Action's
 * override semantics.
 */
export function getReconciliationWizardOverrideUrl(): string {
  return `${getWebApiUrl()}/api/reconciliation/wizard-override`;
}

/**
 * Shift-swap BFF endpoints (ADR-0132 / Sortie 1 of schedule-harness).
 * Mobile never calls the SECURITY DEFINER RPCs
 * (`initiate_shift_swap` / `respond_to_shift_swap` / `cancel_shift_swap`)
 * directly — the BFF re-derives identity server-side (ADR-0176 Invariant 3)
 * and runs the C4 authority gate (ADR-0201) before invoking the RPC via
 * a JWT-scoped client.
 */
export function getShiftSwapInitiateUrl(): string {
  return `${getWebApiUrl()}/api/shift-swap/initiate`;
}
export function getShiftSwapRespondUrl(): string {
  return `${getWebApiUrl()}/api/shift-swap/respond`;
}
export function getShiftSwapCancelUrl(): string {
  return `${getWebApiUrl()}/api/shift-swap/cancel`;
}

/**
 * Employee-availability BFF endpoints (ADR-0132 / Sortie 2 of
 * schedule-harness). Mobile never writes directly to
 * `employee_availability` — the BFF re-derives identity server-side
 * (ADR-0176 Invariant 3) and runs the C4 authority gate (ADR-0201).
 * Capability split per ADR-0202: set_own / clear_own are voice-OK at
 * the capability layer, query_others is chat-only.
 */
export function getAvailabilitySetUrl(): string {
  return `${getWebApiUrl()}/api/availability/set`;
}
export function getAvailabilityClearUrl(): string {
  return `${getWebApiUrl()}/api/availability/clear`;
}
export function getAvailabilityQueryUrl(): string {
  return `${getWebApiUrl()}/api/availability/query`;
}
export function getAvailabilityMeUrl(): string {
  return `${getWebApiUrl()}/api/availability/me`;
}
