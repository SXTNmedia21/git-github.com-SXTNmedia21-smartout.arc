"use server";

import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit } from "@smartout/telemetry";
import { revalidatePath } from "next/cache";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { hasMinimumRole } from "./_shared-utils";

const SignoffSchema = z.object({
  sessionId: z.string().uuid(),
  confirm: z.enum(["pending", "close"]),
  notes: z.string().max(2000).optional(),
});

export type SignoffSessionInput = z.infer<typeof SignoffSchema>;
export type SignoffSessionResult =
  | { ok: true; status: "pending_signoff" | "closed" }
  | { ok: false; error: string };

/**
 * Server Action for WebDayControl signoff flow (ADR-0156, ADR-0114, ADR-0157).
 *
 * `confirm: "pending"` → leder submits for signoff (active → pending_signoff)
 * `confirm: "close"`   → admin finalises (pending_signoff → closed)
 *
 * Auth flow per post-impl R1 fix:
 *   1. `createClient()` (user-JWT) → `resolveCurrentProfile()` identifies
 *      the caller and `hasMinimumRole()` enforces the role gate.
 *   2. `createAdminClient()` (service role) performs the UPDATE because
 *      `jwt_manage_department_session` RLS restricts UPDATE to admin/owner
 *      only — a manager's pending-signoff would silently fail with 0 rows
 *      and no error under user-JWT.
 *
 * Per ADR-0187, the `trg_session_pending_signoff` DB trigger is the sole
 * emitter for active → pending_signoff transitions. This action writes the
 * column and lets the trigger drive `engine_event` fan-out. No inline
 * emit() here — that would violate the single-emitter invariant.
 */
export async function signoffSessionAction(
  input: SignoffSessionInput,
): Promise<SignoffSessionResult> {
  const parsed = SignoffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };

  // Canonical authority gate (ADR-0099 gate_action) + inline role floor
  // as belt-and-braces fallback when no authority row exists for workspace.
  // T3 migration: once session.signoff is seeded for all workspaces, the
  // inline `hasMinimumRole` can be removed. For now both checks must pass.
  if (!hasMinimumRole(profile.role, "manager")) {
    return { ok: false, error: "Ikke tilstrekkelig rettigheter (krever leder eller admin)." };
  }

  const userClient = await createClient();
  const admin = createAdminClient();

  // Load session with user-scoped client so SELECT respects RLS.
  const { data: session, error: loadErr } = await userClient
    .from("department_session")
    .select("department_session_id, workspace_id, department_id, session_date, status")
    .eq("department_session_id", parsed.data.sessionId)
    .maybeSingle();

  if (loadErr || !session) {
    return { ok: false, error: "Sesjonen finnes ikke eller er ikke tilgjengelig." };
  }

  // Authority check — RLS permitted SELECT, now verify workspace match
  // before we bypass RLS with the admin client for UPDATE.
  if (session.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Arbeidsrom-mismatch." };
  }

  if (parsed.data.confirm === "pending") {
    if (session.status !== "active") {
      return {
        ok: false,
        error: `Kan ikke sette til pending_signoff fra status '${session.status}'.`,
      };
    }

    // ADR-0099 gate — capability-level authority + audit row.
    const gate = await gateAction({
      workspaceId: profile.workspaceId,
      capability: "session.signoff",
      channel: "chat",
      actorProfileId: profile.profileId,
      actionType: "pending_signoff",
      entityId: session.department_session_id,
    });
    if (!gate.allow) return { ok: false, error: `Avvist: ${gate.reason ?? "forbidden"}` };
    if (gate.downgrade_to === "suggest") {
      return { ok: false, error: "Rollen din er under minstekravet for signoff." };
    }

    // Emit fires via trg_session_pending_signoff per ADR-0187.
    // Do NOT add inline emit() here — single-emitter invariant.
    const { error: updateErr } = await admin
      .from("department_session")
      .update({
        status: "pending_signoff" as const,
        signoff_notes: parsed.data.notes ?? null,
      })
      .eq("department_session_id", session.department_session_id);

    if (updateErr) return { ok: false, error: updateErr.message };

    revalidatePath("/dashboard");
    return { ok: true, status: "pending_signoff" };
  }

  // confirm === "close"
  if (session.status !== "pending_signoff") {
    return {
      ok: false,
      error: `Kan ikke stenge fra status '${session.status}'. Kreves 'pending_signoff'.`,
    };
  }

  // Admin-only for final close — gate + inline check (see above rationale).
  if (!hasMinimumRole(profile.role, "admin")) {
    return { ok: false, error: "Kun admin kan godkjenne og stenge dagen." };
  }

  const closeGate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "session.close",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "close",
    entityId: session.department_session_id,
  });
  if (!closeGate.allow) return { ok: false, error: `Avvist: ${closeGate.reason ?? "forbidden"}` };
  if (closeGate.downgrade_to === "suggest") {
    return { ok: false, error: "Rollen din er under admin-kravet for å stenge dagen." };
  }

  const { error: closeErr } = await admin
    .from("department_session")
    .update({
      status: "closed" as const,
      closed_at: new Date().toISOString(),
      closed_by: profile.profileId,
    })
    .eq("department_session_id", session.department_session_id);

  if (closeErr) return { ok: false, error: closeErr.message };

  await emit({
    event: "session closed",
    workspace_id: profile.workspaceId,
    actor_id: profile.profileId,
    properties: {
      entity: {
        entity_type: "department_session",
        entity_id: session.department_session_id,
        entity_label: session.session_date,
      },
      data: {
        department_id: session.department_id,
        date: session.session_date,
      },
    },
  });

  revalidatePath("/dashboard");
  return { ok: true, status: "closed" };
}
