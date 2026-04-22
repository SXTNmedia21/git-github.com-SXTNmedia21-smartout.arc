/**
 * Mobile BFF client for journey.run_guided (ADR-0132).
 *
 * CRITICAL CONTRACT (R5.2-1 / ADR-0176 Invariant 3):
 *   The request body MUST NOT contain workspace_id, actor_id, or profile_id.
 *   The server derives those from the authenticated Supabase session.
 *   Any client-supplied identity field is a CVE-class security bug.
 *
 * R5.2-4: no @smartout/ai imports. Mobile never calls capabilities directly.
 * R5.2-3: no empty-string fallback on any identity field — this module never
 *         constructs one; getProfileContext is used only to *gate* UI mount,
 *         not to attach ids to the request.
 */

import { supabase } from "@/lib/supabase";
import { getJourneyGuidedStartUrl, getJourneyGuidedStatusUrl } from "@/lib/web-api";

export type StartGuidedResult = { ok: true; runId: string } | { ok: false; error: string };

export type StatusResponse = {
  run_id: string;
  status: string;
  current_step: number;
  started_at: string;
  completed_at: string | null;
  last_error: string | null;
  steps: Array<{ id: string; step_order: number; action_type: string; status: string }>;
};

export type FetchStatusResult = { ok: true; data: StatusResponse } | { ok: false; error: string };

/**
 * Build the request body for POST /api/journey/guided/start.
 *
 * Exported so tests can assert the exact shape — no workspace_id / actor_id /
 * profile_id keys ever appear (ADR-0176 Invariant 3 / R5.2-1).
 */
export function buildStartGuidedBody(journeyVersionId: string): Record<string, unknown> {
  return { journey_version_id: journeyVersionId };
}

export async function bffStartGuided(journeyVersionId: string): Promise<StartGuidedResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "No session" };

  try {
    const res = await fetch(getJourneyGuidedStartUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildStartGuidedBody(journeyVersionId)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `BFF ${res.status}: ${text || res.statusText}` };
    }
    const json = (await res.json()) as { run_id?: string; status?: string };
    if (!json.run_id) return { ok: false, error: "BFF returned no run_id" };
    return { ok: true, runId: json.run_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

export async function bffFetchStatus(runId: string): Promise<FetchStatusResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "No session" };

  try {
    const res = await fetch(getJourneyGuidedStatusUrl(runId), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { ok: false, error: `BFF ${res.status}` };
    const data = (await res.json()) as StatusResponse;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
