"use server";

/**
 * policy-actions.ts — Server Actions for /dashboard/policies.
 *
 * createPolicy: admin/owner only. Accepts minimal form payload (name,
 * description, policy_type) and applies server-side defaults per plan:
 *   - policy_scope = 'workspace'
 *   - enforcement_status = 'aspirational'
 *   - statement = description    (policy.statement is NOT NULL)
 *   - workspace_id + created_by  derived server-side (ADR-0151)
 *
 * listPolicies: server-side fetch, workspace-scoped, active only.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "@/app/dashboard/_actions/_shared";

// ─── Zod Schemas ──────────────────────────────────────

const policyTypeEnum = z.enum([
  "operational",
  "haccp",
  "hr",
  "safety",
  "access",
  "payroll",
  "custom",
]);

const createPolicySchema = z.object({
  name: z.string().min(1, "Tittel er påkrevd").max(200),
  description: z.string().min(1, "Beskrivelse er påkrevd").max(2000),
  policy_type: policyTypeEnum,
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export type CreatePolicyResult = { ok: true; policy_id: string } | { ok: false; error: string };

export type PolicyRow = {
  policy_id: string;
  name: string;
  policy_type: string;
  policy_scope: string;
  enforcement_status: string;
  is_active: boolean;
  created_at: string;
};

// ─── createPolicy ──────────────────────────────────────

/**
 * Creates a new workspace-scoped policy.
 *
 * Authority: gated via gate_action("policy.create_manual") per ADR-0099.
 * workspace_id and created_by are derived server-side per ADR-0151 — never
 * accepted from form body. Admin-client write after gate to bypass RLS
 * (gate enforces role floor via engine_authority_config seed).
 * Emits "policy created" per ADR-0134 (nonEmpty for workspace_id + actor_id).
 *
 * Capability seed: supabase/migrations/<ts>_policy_create_manual_capability_seed.sql
 * Sortie 1 of M5 HMS 4-sortie sequence. Council-verified 2026-05-17.
 * ADR refs: 0099, 0114, 0134, 0151, 0204.
 */
export async function createPolicy(input: CreatePolicyInput): Promise<CreatePolicyResult> {
  const parsed = createPolicySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: `Validation failed: ${parsed.error.message}` };
  }

  const profile = await resolveCurrentProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const { profileId, workspaceId } = profile;

  /* @authority-gate: capability='policy.create_manual' level='confirm' min_role='admin'
     seed='<ts>_policy_create_manual_capability_seed.sql' */
  // ADR-0099: gate_action() RPC replaces role-string check. The seed migration
  // sets min_role='admin', so owners + admins are allowed; managers and below
  // receive downgrade_to='suggest' which this action treats as denied.
  const gate = await gateAction({
    workspaceId,
    capability: "policy.create_manual",
    channel: "chat",
    actorProfileId: profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Kun admin og owner kan opprette policies" };
  }

  // Admin client bypasses RLS — gate above enforces role floor (ADR-0204).
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("policy")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description,
      // statement is NOT NULL — use description as the initial statement value.
      statement: parsed.data.description,
      policy_type: parsed.data.policy_type,
      // Server-side defaults per plan (never trusted from form body).
      policy_scope: "workspace",
      enforcement_status: "aspirational",
      workspace_id: workspaceId,
      created_by: profileId,
    })
    .select("policy_id")
    .single();

  if (error) {
    return { ok: false, error: `Insert failed: ${error.message}` };
  }

  const policyId = data.policy_id;

  await emit({
    event: "policy created",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "policy",
        entity_id: policyId,
        entity_label: parsed.data.name,
      },
      data: {
        policy_type: parsed.data.policy_type,
      },
    },
  });

  revalidatePath("/dashboard/policies");

  return { ok: true, policy_id: policyId };
}

// ─── listPolicies ──────────────────────────────────────

/**
 * Server-side fetch of active policies for a workspace.
 * Capped at 200 rows, ordered by created_at DESC.
 */
export async function listPolicies(workspaceId: string): Promise<PolicyRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("policy")
    .select("policy_id, name, policy_type, policy_scope, enforcement_status, is_active, created_at")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[listPolicies] error:", error.message);
    return [];
  }

  return (data ?? []) as PolicyRow[];
}
