"use server";

/**
 * addTaskAction — ADR-0298 Sortie 3: now a thin wrapper around task.create_session
 * tool body. Server Action shape preserved for WebDayControl Oppgaver callers;
 * 30-day alias period ends Sortie 5.
 *
 * All gate / insert / emit logic lives in the capability tool body (createSession.execute).
 * This wrapper only adapts the calling shape (cookie vs Bearer actor, AddTaskInput →
 * create_session tool params, JSON string result → AddTaskResult).
 *
 * References: ADR-0099, ADR-0132, ADR-0134, ADR-0151, ADR-0266, ADR-0298.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { createClient } from "@smartout/supabase/server";
import { createSession } from "@smartout/ai/capabilities/task/tools";
import type { NonEmptyString } from "@smartout/telemetry/server";

/**
 * Server-derived actor identity supplied by the BFF when the caller is the
 * mobile surface. Mirrors the shape returned by resolveCurrentProfile().
 */
export type ResolvedActor = {
  profileId: string;
  workspaceId: string;
  role: string | null;
};

const InputSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1, "Tittel er påkrevd.").max(200, "Tittel for lang."),
  ownerProfileId: z.string().uuid().optional().nullable(),
  hookId: z.string().uuid().optional().nullable(),
  isComplianceRequired: z.boolean().default(false),
  reason: z.string().trim().min(8, "Begrunnelse må være minst 8 tegn."),
});

export type AddTaskInput = z.infer<typeof InputSchema>;
export type AddTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

export async function addTaskAction(
  input: AddTaskInput,
  actor?: ResolvedActor,
  channel: "chat" | "system" = "chat",
): Promise<AddTaskResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ugyldig input." };
  }

  // Resolve profile: BFF supplies pre-resolved actor (mobile/ADR-0151);
  // web cookie path resolves from session here.
  let profile: ResolvedActor | null = actor ?? null;
  if (!profile) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ikke autentisert." };
    const { data: row } = await supabase
      .from("profile")
      .select("profile_id, workspace_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!row) return { ok: false, error: "Ikke autentisert." };
    profile = { profileId: row.profile_id, workspaceId: row.workspace_id, role: row.role ?? null };
  }

  if (!profile.profileId || !profile.workspaceId) {
    return { ok: false, error: "Ikke autentisert." };
  }

  // Synthesize AgentToolContext and delegate to task.create_session tool body.
  // The tool owns all 6 steps: workspace match, hook validation, assignee validation,
  // gate, insert, emit (including 30-day task.added_manual alias).
  const supabaseAdmin = createAdminClient();
  const ctx = {
    workspaceId: profile.workspaceId as NonEmptyString,
    profileId: profile.profileId as NonEmptyString,
    sessionId: "server-action",
    channel: channel === "system" ? ("system" as const) : ("chat" as const),
    supabaseAdmin,
  };

  const raw = await createSession.execute(
    {
      session_id: parsed.data.sessionId,
      title: parsed.data.title,
      assignee_profile_id: parsed.data.ownerProfileId ?? undefined,
      hook_id: parsed.data.hookId ?? undefined,
      compliance: parsed.data.isComplianceRequired,
      reason: parsed.data.reason,
    },
    ctx,
  );

  let result: { id?: string; ok?: boolean; error?: string } = {};
  try {
    result = JSON.parse(raw) as { id?: string; ok?: boolean; error?: string };
  } catch {
    return { ok: false, error: "Uventet svar fra oppgavemotor." };
  }

  if (result.ok === false || result.id === undefined) {
    // Map tool error codes → Norwegian user-facing messages for existing callers.
    const err = result.error ?? "ukjent";
    if (err === "session_not_found_or_wrong_workspace") {
      return { ok: false, error: "Dagen finnes ikke eller annet arbeidsrom." };
    }
    if (err === "hook_not_in_session_department") {
      return { ok: false, error: "Valgt hook tilhører ikke denne avdelingen." };
    }
    if (err === "assignee_not_in_workspace") {
      return { ok: false, error: "Valgt ansvarlig finnes ikke i arbeidsrommet." };
    }
    if (err.startsWith("ikke_tillatt") || err.includes("gate")) {
      return { ok: false, error: `Ikke autorisert: ${err}` };
    }
    return { ok: false, error: err };
  }

  return { ok: true, taskId: result.id };
}
