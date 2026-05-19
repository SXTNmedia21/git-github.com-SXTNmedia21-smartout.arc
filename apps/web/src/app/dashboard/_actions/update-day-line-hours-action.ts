"use server";

/**
 * updateDayLineHoursAction — Server Action wrapping day-line.update_hours tool.
 *
 * Patches planned_open and/or planned_close on an existing day_line.
 * No-op when both values are identical to existing (tool handles this).
 * Emits day_line.opening_changed and/or day_line.closing_changed per changed field.
 *
 * Identity is ALWAYS server-derived via resolveCurrentProfile() (ADR-0151 / L-0177).
 *
 * References: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0367.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "./_shared";
import { updateHours } from "@smartout/ai/capabilities/day-line/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

const TimeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Must be HH:MM or HH:MM:SS");

const InputSchema = z
  .object({
    day_line_id: z.string().uuid(),
    planned_open: TimeSchema.optional(),
    planned_close: TimeSchema.optional(),
  })
  .refine((d) => d.planned_open !== undefined || d.planned_close !== undefined, {
    message: "At least one of planned_open / planned_close is required.",
  });

export type UpdateDayLineHoursInput = z.infer<typeof InputSchema>;
export type UpdateDayLineHoursResult =
  | { ok: true; no_op?: boolean; patched?: Record<string, string> }
  | { ok: false; error: string };

export async function updateDayLineHoursAction(
  input: UpdateDayLineHoursInput,
): Promise<UpdateDayLineHoursResult> {
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

  const raw = await updateHours.execute(parsed.data, ctx);

  let result: {
    ok?: boolean;
    no_op?: boolean;
    patched?: Record<string, string>;
    error?: string;
  } = {};
  try {
    result = JSON.parse(raw) as typeof result;
  } catch {
    return { ok: false, error: "Uventet svar fra dag-linje-motor." };
  }

  if (result.ok === false) {
    return { ok: false, error: result.error ?? "ukjent_feil" };
  }

  return {
    ok: true,
    ...(result.no_op ? { no_op: true } : {}),
    ...(result.patched ? { patched: result.patched } : {}),
  };
}
