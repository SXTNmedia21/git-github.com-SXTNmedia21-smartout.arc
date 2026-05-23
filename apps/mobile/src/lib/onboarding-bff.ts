/**
 * Mobile BFF client for employee onboarding (ADR-0132).
 *
 * Wraps all three BFF endpoints:
 *   POST /api/mobile/employee-onboarding/save-step
 *   GET  /api/mobile/employee-onboarding/state
 *   PUT  /api/mobile/employee-onboarding/state
 *   POST /api/mobile/employee-onboarding/state/dismiss
 *
 * CRITICAL CONTRACT (ADR-0176 Invariant 3):
 *   The request body MUST NOT contain workspace_id, actor_id, or profile_id.
 *   The server derives identity from the authenticated Supabase Bearer token.
 *   Any client-supplied identity field is a CVE-class security bug.
 *
 * Pattern: mirrors journey-bff.ts — Bearer token from getSession(), no
 * direct Supabase writes for user_identity fields.
 */

import { supabase } from "@/lib/supabase";
import { getWebApiUrl } from "@/lib/web-api";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Step keys recognised by the /save-step BFF route. */
export type OnboardingStep =
  | "contact"
  | "address"
  | "personal_number"
  | "availability"
  | "consent"
  | "optional"
  | "complete";

export type OnboardingStateResponse = {
  status: string;
  current_step_index: number;
  step_data: Record<string, unknown>;
  dismissed_at: string | null;
  completed_at: string | null;
};

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getBearerToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Ikke innlogget");
  return session.access_token;
}

function jsonHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ─── URL helpers (internal) ───────────────────────────────────────────────────

function getSaveStepUrl(): string {
  return `${getWebApiUrl()}/api/mobile/employee-onboarding/save-step`;
}

function getStateUrl(): string {
  return `${getWebApiUrl()}/api/mobile/employee-onboarding/state`;
}

function getDismissUrl(): string {
  return `${getWebApiUrl()}/api/mobile/employee-onboarding/state/dismiss`;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Persist a single wizard step to the server.
 *
 * `values` shape is validated by the BFF Zod schema for each step.
 * Contact step: { firstName, lastName, phone } (camelCase — per ContactValues schema).
 *
 * Throws on network error or non-2xx response with the server's error message.
 */
export async function saveOnboardingStep(
  step: OnboardingStep,
  values: Record<string, unknown>,
): Promise<void> {
  const token = await getBearerToken();
  const res = await fetch(getSaveStepUrl(), {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ step, values }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Serverfeil (${res.status})`);
  }
}

/**
 * Update wizard state (current step + accumulated step_data).
 * Called after each step completes to enable resume.
 */
export async function putOnboardingState(
  currentStepIndex: number,
  stepData: Record<string, unknown>,
): Promise<void> {
  const token = await getBearerToken();
  const res = await fetch(getStateUrl(), {
    method: "PUT",
    headers: jsonHeaders(token),
    body: JSON.stringify({ current_step_index: currentStepIndex, step_data: stepData }),
  });
  if (!res.ok) throw new Error(`state PUT failed (${res.status})`);
}

/**
 * Fetch the current onboarding state (for resume on re-open).
 */
export async function getOnboardingState(): Promise<OnboardingStateResponse> {
  const token = await getBearerToken();
  const res = await fetch(getStateUrl(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`state GET failed (${res.status})`);
  const body = (await res.json()) as { state: OnboardingStateResponse };
  return body.state;
}

/**
 * Dismiss the onboarding wizard — marks it as dismissed so it won't
 * auto-show on next app open. Employee can re-open from settings.
 */
export async function dismissOnboarding(): Promise<void> {
  const token = await getBearerToken();
  await fetch(getDismissUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
