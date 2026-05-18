"use server";

/**
 * addDayLineItemAction — Server Action wrapping day-line.add_item capability tool.
 *
 * V1: item_type="task" | "routine" only.
 *
 * Identity is ALWAYS server-derived via resolveCurrentProfile() (ADR-0151 / L-0177).
 * Cross-namespace delegation (task.create_session / timeline_template.apply_template)
 * happens inside the capability tool body per ADR-0240 + ADR-0356.
 *
 * References: ADR-0078, ADR-0099, ADR-0134, ADR-0151, ADR-0173, ADR-0240, ADR-0367.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { resolveCurrentProfile } from "./_shared";
import { addItem } from "@smartout/ai/capabilities/day-line/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

const TaskItemSchema = z.object({
  day_line_id: z.string().uuid(),
  item_type: z.literal("task"),
  title: z.string().min(1).max(200),
  assigned_to: z.string().uuid().optional(),
});

const RoutineItemSchema = z.object({
  day_line_id: z.string().uuid(),
  item_type: z.literal("routine"),
  template_id: z.string().uuid(),
});

const InputSchema = z.discriminatedUnion("item_type", [TaskItemSchema, RoutineItemSchema]);

export type AddDayLineItemInput = z.infer<typeof InputSchema>;
export type AddDayLineItemResult =
  | { ok: true; task_id?: string; items_applied?: number }
  | { ok: false; error: string };

export async function addDayLineItemAction(
  input: AddDayLineItemInput,
): Promise<AddDayLineItemResult> {
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

  const raw = await addItem.execute(parsed.data, ctx);

  let result: { ok?: boolean; task_id?: string; items_applied?: number; error?: string } = {};
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
    ...(result.task_id ? { task_id: result.task_id } : {}),
    ...(result.items_applied !== undefined ? { items_applied: result.items_applied } : {}),
  };
}
