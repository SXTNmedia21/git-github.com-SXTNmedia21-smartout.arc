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

/**
 * Absolute URL for the employee-facing voice-transcript endpoint
 * (Phase C1, ADR-0132 / ADR-0135). Mobile posts ASR transcripts here;
 * the BFF pins `channel='voice'` server-side and forwards to stage-engine.
 */
export function getEmmaVoiceTranscriptUrl(): string {
  return `${getWebApiUrl()}/api/emma/voice/transcript`;
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
 * Mobile shift-create BFF endpoint (ADR-0270 — mobile shift authoring via BFF).
 * Manager POSTs shift data here; BFF derives workspace_id from JWT (ADR-0151)
 * and delegates to addShiftAction server-side.
 *
 * TODO: Phase 3a must create apps/web/src/app/api/mobile/shifts/route.ts.
 * This URL is correct — wiring is ready, route just needs to be committed.
 */
export function getMobileShiftsUrl(): string {
  return `${getWebApiUrl()}/api/mobile/shifts`;
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

/**
 * Mobile task-create BFF endpoint (ADR-0132 / ADR-0266).
 * Mobile never inserts into `session_task` directly — the BFF re-derives
 * identity server-side (ADR-0176 Invariant 3) and runs gate_action +
 * emit() before writing (ADR-0099, ADR-0134).
 */
export function getMobileTasksUrl(): string {
  return `${getWebApiUrl()}/api/mobile/tasks`;
}

/**
 * Booking BFF endpoint (ADR-0270, ADR-0267 — booking-PII gate).
 * Mobile never inserts into schedule_day_booking directly — the BFF
 * re-derives identity server-side (ADR-0151) and runs gate_action()
 * with capability='schedule.add_booking_manual' (ADR-0099).
 * contact field is PII (ADR-0267); channel is pinned to 'system' by the BFF.
 */
export function getBookingCreateUrl(): string {
  return `${getWebApiUrl()}/api/mobile/bookings`;
}

/**
 * Shift Marketplace BFF endpoints (ADR-0132 / ADR-0306).
 * Mobile never writes directly to schedule_shift_offer — the BFF re-derives
 * identity server-side (ADR-0151) and runs gate_action + emit() (ADR-0099,
 * ADR-0134). Claim is chat-only per ADR-0288; mobile surface = chat channel.
 */
export function getMarketplaceOpenOffersUrl(): string {
  return `${getWebApiUrl()}/api/mobile/marketplace/open-offers`;
}
export function getMarketplaceClaimUrl(): string {
  return `${getWebApiUrl()}/api/mobile/marketplace/claim`;
}

/**
 * Lønnsgrunnlag signed-URL BFF endpoint (Wave B / Phase 4, ADR-0133).
 * Employee GETs a signed URL for their own PDF lønnsgrunnlag.
 * BFF re-derives identity server-side (ADR-0151), verifies employee owns
 * the profile_id on the export_event, then returns a ~1h signed URL.
 *
 * Wave B route is being built in parallel. The hook (use-lonnsgrunnlag.ts)
 * has `enabled: eventId.length > 0 && profileId.length > 0` so it will
 * remain disabled until the route is live — no runtime failure during the
 * Wave D shipping window.
 */
export function getLonnsgrunnlagUrlEndpoint(eventId: string, profileId: string): string {
  return `${getWebApiUrl()}/api/payroll/lonnsgrunnlag-url?lonnsgrunnlagId=${encodeURIComponent(eventId)}&profileId=${encodeURIComponent(profileId)}`;
}

/**
 * Scheduler BFF endpoints (ADR-0133 — Accept/Reject are Approve verbs, mobile-allowed).
 * ADR-0309 — atomic bundle accept/reject. Mobile never writes change_proposal directly.
 * ADR-0151 — workspace_id + profile_id re-derived server-side from Bearer token.
 */
export function getSchedulerProposalsUrl(workspaceId?: string): string {
  const base = `${getWebApiUrl()}/api/scheduler/proposals?status=pending`;
  return workspaceId ? `${base}&workspace_id=${encodeURIComponent(workspaceId)}` : base;
}

export function getSchedulerAcceptBundleUrl(): string {
  return `${getWebApiUrl()}/api/scheduler/accept-bundle`;
}

export function getSchedulerRejectBundleUrl(): string {
  return `${getWebApiUrl()}/api/scheduler/reject-bundle`;
}
