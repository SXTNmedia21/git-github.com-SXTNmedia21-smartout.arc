"use server";

/**
 * instantiateTemplateAction — Server Action wrapping day-line.instantiate_template tool.
 *
 * Convenience form of addDayLineItemAction for the routine branch.
 * Delegates to timeline_template.apply_template via the capability tool body (ADR-0240).
 *
 * Identity is ALWAYS server-derived via resolveCurrentProfile() (ADR-0151 / L-0177).
 *
 * References: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0240, ADR-0356, ADR-0367.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "./_shared";
import { instantiateTemplate } from "@smartout/ai/capabilities/day-line/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

const InputSchema = z.object({
  day_line_id: z.string().uuid(),
  template_id: z.string().uuid(),
});

export type InstantiateTemplateInput = z.infer<typeof InputSchema>;
export type InstantiateTemplateResult =
  | { ok: true; items_applied: number }
  | { ok: false; error: string };

export async function instantiateTemplateAction(
  input: InstantiateTemplateInput,
): Promise<InstantiateTemplateResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  // ADR-0151: server-derive actor identity.
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };
  if (!profile.profileId || !profile.workspaceId) {
    return { ok: false, error: "Ikke autentisert." };
  }

  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: profile.workspaceId as NonEmptyString,
    profileId: profile.profileId as NonEmptyString,
    sessionId: "server-action",
    channel: "chat" as const,
    supabaseAdmin,
  };

  const raw = await instantiateTemplate.execute(parsed.data, ctx);

  let result: { ok?: boolean; items_applied?: number; error?: string } = {};
  try {
    result = JSON.parse(raw) as typeof result;
  } catch {
    return { ok: false, error: "Uventet svar fra dag-linje-motor." };
  }

  if (result.ok === false) {
    return { ok: false, error: result.error ?? "ukjent_feil" };
  }

  return { ok: true, items_applied: result.items_applied ?? 0 };
}
