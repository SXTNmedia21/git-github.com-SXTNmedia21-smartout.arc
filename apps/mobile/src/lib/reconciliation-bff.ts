/**
 * Mobile BFF client for reconciliation wizard admin-override (closure Item 4).
 *
 * CRITICAL CONTRACT (R5.2-1 / ADR-0176 Invariant 3):
 *   The request body MUST NOT contain workspace_id, actor_id, or profile_id.
 *   The server derives those from the authenticated Supabase session.
 *   Any client-supplied identity field is a CVE-class security bug.
 *
 * R5.2-4: no @smartout/ai imports. Mobile never calls capabilities directly.
 * R5.2-3: no empty-string fallback on any identity field — this module never
 *         constructs one.
 *
 * Pattern mirrors `journey-bff.ts` — Bearer token via Supabase session,
 * BFF performs dual-auth + authority gate + activity_trail write.
 */

import { supabase } from "@/lib/supabase";
import { getReconciliationWizardOverrideUrl } from "@/lib/web-api";

export type OverrideResult = { ok: true; reconciliationId: string } | { ok: false; error: string };

/**
 * Build the request body for POST /api/reconciliation/wizard-override.
 *
 * Exported so a future assertion can grep the exact shape — no
 * workspace_id / actor_id / profile_id keys ever appear (ADR-0176
 * Invariant 3 / R5.2-1).
 */
export function buildWizardOverrideBody(
  sessionId: string,
  reason: string,
  blockerCodes: string[],
): Record<string, unknown> {
  return { sessionId, reason, blockerCodes };
}

export async function bffOverrideWizardBlocker(
  sessionId: string,
  reason: string,
  blockerCodes: string[],
): Promise<OverrideResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, error: "Ikke innlogget." };

  try {
    const res = await fetch(getReconciliationWizardOverrideUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildWizardOverrideBody(sessionId, reason, blockerCodes)),
    });

    if (!res.ok) {
      // Surface the BFF's Norwegian-localised error message when present.
      let msg = `BFF ${res.status}`;
      try {
        const parsed = (await res.json()) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        const text = await res.text().catch(() => "");
        if (text) msg = text;
      }
      return { ok: false, error: msg };
    }

    const json = (await res.json()) as { ok?: boolean; reconciliation_id?: string };
    if (!json.ok || !json.reconciliation_id) {
      return { ok: false, error: "BFF returnerte uventet svar." };
    }
    return { ok: true, reconciliationId: json.reconciliation_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Nettverksfeil." };
  }
}
