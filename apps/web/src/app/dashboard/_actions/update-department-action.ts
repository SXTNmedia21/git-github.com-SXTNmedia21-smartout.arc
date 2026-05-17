"use server";

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";

/**
 * updateDepartmentAction — admin/manager updates an existing department.
 *
 * Replaces the browser-direct `supabase.from("department").update()` call
 * that existed in EditDepartmentDialog.handleSave. That path had no gate,
 * no emit, and no workspace_id pin — violating ADR-0099, ADR-0134, and
 * L-0177 simultaneously, and was amplified by the Botsson bridge tool
 * (openDepartmentEdit) making it agent-callable (council B2 blocker,
 * 2026-05-14).
 *
 * Authority gate: `organization.update_department` (seeded by migration
 * 20260616100400_seed_organization_update_department_authority.sql).
 * Default level = "confirm", min_role = "manager" — requires manager+ role.
 *
 * Telemetry: emits "department updated" (registry.ts line 364) with
 * EntityRef + changes map. All four destinations (posthog / logger /
 * activity_trail / engine_event) flow through emit() per ADR-0134.
 *
 * workspace_id is server-derived from the authenticated user's session
 * (resolveCurrentProfile), never accepted from client body (ADR-0151).
 * The department's workspace_id is cross-verified against the actor's
 * workspace before any write.
 */

const InputSchema = z.object({
  departmentId: z.string().uuid("department_id must be a UUID"),
  name: z.string().min(1, "Avdelingsnavn er påkrevd.").max(100, "Navn er for langt."),
  slug: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  managerProfileId: z.string().uuid().nullable(),
});

export type UpdateDepartmentInput = z.infer<typeof InputSchema>;
export type UpdateDepartmentResult =
  | { ok: true; departmentId: string }
  | { ok: false; error: string };

export async function updateDepartmentAction(
  input: UpdateDepartmentInput,
): Promise<UpdateDepartmentResult> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // Server-side identity resolution per ADR-0151 — never trust client body.
  const profile = await resolveCurrentProfile();
  if (!profile) return { ok: false, error: "Ikke autentisert." };
  if (!profile.profileId.trim() || !profile.workspaceId.trim()) {
    return { ok: false, error: "Ugyldig aktør-identitet." };
  }

  const admin = createAdminClient();

  // Cross-workspace guard: verify the department belongs to the actor's workspace.
  // Fail-fast with explicit 4xx-equivalent error — no silent fallback (L-0177).
  const { data: existing } = await admin
    .from("department")
    .select("department_id, workspace_id, name, description, color, icon, manager_profile_id")
    .eq("department_id", parsed.data.departmentId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Avdeling ikke funnet." };
  }
  if (existing.workspace_id !== profile.workspaceId) {
    return { ok: false, error: "Avdeling tilhører et annet workspace." };
  }

  // Authority gate per ADR-0099. Seeded with level='confirm', min_role='manager'.
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "organization.update_department",
    channel: "chat",
    actorProfileId: profile.profileId,
    actionType: "update",
    entityId: parsed.data.departmentId,
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // Validate managerProfileId belongs to the same workspace when provided.
  if (parsed.data.managerProfileId) {
    const { data: mgr } = await admin
      .from("profile")
      .select("profile_id, workspace_id")
      .eq("profile_id", parsed.data.managerProfileId)
      .maybeSingle();
    if (!mgr || mgr.workspace_id !== profile.workspaceId) {
      return { ok: false, error: "Valgt leder tilhører et annet workspace." };
    }
  }

  const { error: updateError } = await admin
    .from("department")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      color: parsed.data.color,
      icon: parsed.data.icon,
      manager_profile_id: parsed.data.managerProfileId,
    })
    .eq("department_id", parsed.data.departmentId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Build changes map for telemetry — only include fields that actually changed.
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  if (existing.name !== parsed.data.name) {
    changes.name = { before: existing.name, after: parsed.data.name };
  }
  if (existing.description !== parsed.data.description) {
    changes.description = { before: existing.description, after: parsed.data.description };
  }
  if (existing.color !== parsed.data.color) {
    changes.color = { before: existing.color, after: parsed.data.color };
  }
  if (existing.icon !== parsed.data.icon) {
    changes.icon = { before: existing.icon, after: parsed.data.icon };
  }
  if (existing.manager_profile_id !== parsed.data.managerProfileId) {
    changes.manager_profile_id = {
      before: existing.manager_profile_id,
      after: parsed.data.managerProfileId,
    };
  }

  await emit({
    event: "department updated",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "department" as const,
        entity_id: parsed.data.departmentId,
        entity_label: parsed.data.name,
      },
      changes,
    },
  });

  return { ok: true, departmentId: parsed.data.departmentId };
}
