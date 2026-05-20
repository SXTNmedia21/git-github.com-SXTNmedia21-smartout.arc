"use server";

/**
 * createDayLineAction — Server Action wrapping day-line.create capability tool.
 *
 * Identity is ALWAYS server-derived via resolveCurrentProfile() — never from
 * the input body (ADR-0151 / L-0177). Builds AgentToolContext and delegates
 * all gate / insert / emit logic to the capability tool body.
 *
 * References: ADR-0099, ADR-0134, ADR-0151, ADR-0367.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "./_shared";
import { create } from "@smartout/ai/capabilities/day-line/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

const InputSchema = z.object({
  department_session_id: z.string().uuid(),
  location_id: z.string().uuid(),
  planned_open: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  planned_close: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  source_template_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateDayLineInput = z.infer<typeof InputSchema>;
export type CreateDayLineResult = { ok: true; day_line_id: string } | { ok: false; error: string };

export async function createDayLineAction(input: CreateDayLineInput): Promise<CreateDayLineResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  // ADR-0151: server-derive actor identity — never trust body.
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

  const raw = await create.execute(parsed.data, ctx);

  let result: { ok?: boolean; day_line_id?: string; error?: string } = {};
  try {
    result = JSON.parse(raw) as typeof result;
  } catch {
    return { ok: false, error: "Uventet svar fra dag-linje-motor." };
  }

  if (result.ok === false || !result.day_line_id) {
    return { ok: false, error: result.error ?? "ukjent_feil" };
  }

  return { ok: true, day_line_id: result.day_line_id };
}
