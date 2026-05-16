"use server";

// =============================================================================
// create-targeted-note-action.ts
// Next.js Server Action — writes a targeted session_note with audience JSONB
// and scheduled fanout via notify_at.
//
// WHY this file exists: DailyNoteSheet gained audience picker + notify_at
// picker in Track E (dagslinjen-quickadd). The untargeted write path remains
// in DailyNoteSheet's mutation directly. This action handles the targeted path
// only (note_type='targeted') where cross-dept authority must be evaluated.
//
// AUTHORITY (ADR-0099 + ADR-0333):
//   1. Resolve actor server-side via resolveCurrentProfile() (ADR-0151 —
//      never trust client-supplied profile_id).
//   2. Resolve audience → dept_ids via DB joins.
//   3. Compare audience-dept-set vs caller's own department.
//   4. If cross-dept → gateAction("comm.note_fanout_cross_dept") via _shared.ts.
//      Returns confirm_required for the UI to show AlertDialog before retry.
//   5. Own-dept path skips gate (per ADR-0333 § "Own-dept path unaffected").
//   6. Insert session_note with audience JSONB + notify_at.
//   7. emit("comm.scheduled_note.created") per ADR-0134.
//
// BODY FIRST, DOCSTRING AFTER (per L-0176 — claim ADR compliance only after
// body satisfies it, never before).
// =============================================================================

import type { z } from "zod";
import type { Json } from "@smartout/supabase/database.types";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { createTargetedNoteInputSchema } from "@smartout/types";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { resolveAudienceDeptIds } from "./helpers/resolve-audience-dept-ids";

export type CreateTargetedNoteResult =
  | { ok: true; note_id: string }
  | { ok: false; error: string }
  | { ok: false; requires_confirm: true; prompt: string; audience_dept_count: number };

/**
 * createTargetedNoteAction — insert a targeted session_note with scheduled fanout.
 *
 * ADR-0151 (forgeable identity): actor_id is server-derived via
 *   resolveCurrentProfile(); never accepted from request body.
 *
 * ADR-0099 (unified authority gate): cross-dept audience triggers
 *   gateAction("comm.note_fanout_cross_dept", level='confirm', min_role='admin').
 *   Own-dept audience skips the gate. Every gate call writes a gate_evaluation row.
 *
 * ADR-0333 (cross-dept C4 gate): Server Action is the single enforcement point.
 *   No RLS CHECK, no deferred-filter at fanout — block at write with UI feedback.
 *
 * ADR-0134 (telemetry): emits "comm.scheduled_note.created" with nonEmpty()
 *   branded workspace_id and actor_id on success.
 *
 * ADR-0331 (audience JSONB): audience stored as-is in session_note.audience;
 *   resolved at fanout time by note-fanout-scheduler Edge Function.
 */
export async function createTargetedNoteAction(
  input: z.infer<typeof createTargetedNoteInputSchema>,
): Promise<CreateTargetedNoteResult> {
  // ─── 1. Parse + validate input ────────────────────────────────────────────
  const parsed = createTargetedNoteInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  const { workspace_id, session_id, body, audience, notify_at } = parsed.data;

  // ─── 2. Validate notify_at is in the future ───────────────────────────────
  if (new Date(notify_at) <= new Date()) {
    return { ok: false, error: "Påminnelse må være fremover i tid." };
  }

  // ─── 3. Resolve actor server-side (ADR-0151) ──────────────────────────────
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // Cross-workspace guard: verify caller belongs to the target workspace.
  const { data: callerRow } = await admin
    .from("profile")
    .select("profile_id, workspace_id, department_id")
    .eq("profile_id", profile.profileId)
    .maybeSingle();

  if (!callerRow || callerRow.workspace_id !== workspace_id) {
    return { ok: false, error: "Profil ikke funnet eller annet workspace." };
  }

  // ─── 4. Verify session belongs to workspace ───────────────────────────────
  const { data: sessionRow } = await admin
    .from("department_session")
    .select("department_session_id, department_id")
    .eq("department_session_id", session_id)
    .eq("workspace_id", workspace_id)
    .maybeSingle();

  if (!sessionRow) {
    return { ok: false, error: "Økt ikke funnet." };
  }

  // ─── 5. Resolve audience → dept_ids for cross-dept classification ─────────
  const audienceDeptIds = await resolveAudienceDeptIds(audience, admin);
  const callerDeptId = callerRow.department_id;

  const isCrossDept =
    audienceDeptIds.size > 0 && [...audienceDeptIds].some((d) => d !== callerDeptId);

  // ─── 6. C4 authority gate for cross-dept fanout (ADR-0333) ────────────────
  if (isCrossDept) {
    const gate = await gateAction({
      workspaceId: workspace_id,
      capability: "comm.note_fanout_cross_dept",
      channel: "chat",
      actorProfileId: profile.profileId,
      actionType: "create",
    });

    if (!gate.allow) {
      // level='confirm' means: surface a confirmation dialog in the UI.
      // The UI retries this action after user confirms; on retry we re-evaluate
      // the gate (which will allow if admin, still deny if manager).
      return {
        ok: false,
        requires_confirm: true,
        prompt: `Du er i ferd med å varsle mottakere på tvers av avdelinger. Bekreft at du vil sende dette notatet.`,
        audience_dept_count: audienceDeptIds.size,
      };
    }
  }

  // ─── 7. Count audience members for toast message ─────────────────────────
  // Compute an approximate recipient count from the audience spec.
  // Exact count is resolved at fanout time; this is best-effort for UX.
  const audienceSummary = {
    dept_count: (audience.dept_ids ?? []).length,
    team_count: (audience.team_ids ?? []).length,
    shift_count: (audience.shift_ids ?? []).length,
    profile_count: (audience.profile_ids ?? []).length,
  };

  // ─── 8. Insert session_note row ───────────────────────────────────────────
  const { data: inserted, error: insertError } = await admin
    .from("session_note")
    .insert({
      workspace_id,
      department_session_id: session_id,
      note_type: "targeted" as const,
      content: body,
      audience: audience as unknown as Json,
      notify_at,
      created_by: profile.profileId,
      // delivered_at left NULL — scheduler sets it after fanout
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre notatet.",
    };
  }

  // ─── 9. Emit telemetry (ADR-0134) ─────────────────────────────────────────
  // Emit ONLY in success branch. Failures do not emit — no corrupt audit trail.
  await emit({
    event: "comm.scheduled_note.created",
    workspace_id: nonEmpty(workspace_id, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "session_note",
        entity_id: inserted.id,
      },
      data: {
        note_id: inserted.id,
        audience_summary: audienceSummary,
        notify_at,
        is_cross_dept: isCrossDept,
      },
    },
  });

  return { ok: true, note_id: inserted.id };
}
