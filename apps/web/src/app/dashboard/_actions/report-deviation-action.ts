"use server";

/**
 * report-deviation-action.ts — Server Action: Report an HMS deviation.
 *
 * WHY: `useCreateDeviation` was an ADR-0114 violation — direct client-side
 * `useMutation` calling `supabase.from("deviation").insert(...)` without
 * authority gate + with fire-and-forget (void) emit. This action replaces
 * that path with:
 *   1. Server-side profile re-derivation per ADR-0151 (never trust body IDs).
 *   2. Cross-workspace guard — reporter must belong to target workspace.
 *   3. gate_action() RPC (ADR-0099) on capability `hms.report_deviation_manual`.
 *   4. Admin insert (service role) so RLS never blocks a gated write.
 *   5. await emit() (ADR-0134) — four destinations, all server-side, reliable.
 *
 * Channel param follows the Lovsen S5 / ADR-0078 pattern: web callers omit →
 * default "chat"; BFF mobile callers pass channel: "system".
 *
 * Authority seeded in: supabase/migrations/<TS>_seed_deviation_authority.sql
 * Closes ADR-0114 violation surface for the deviation domain.
 */

import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { resolveCurrentProfile, gateAction } from "./_shared";
import { DeviationPayloadSchema } from "@smartout/hms";

// ── Input schema ──────────────────────────────────────────────────────────────
//
// Omits workspace_id + reported_by from client input — both are derived
// server-side (ADR-0151). channel defaults to "chat" so web callers need
// not pass it; BFF mobile callers pass "system".
const InputSchema = DeviationPayloadSchema.omit({
  workspace_id: true,
  reported_by: true,
}).extend({
  channel: z.enum(["chat", "voice", "system"]).default("chat"),
});

export type ReportDeviationInput = z.infer<typeof InputSchema>;
export type ReportDeviationResult =
  | { ok: true; deviationId: string }
  | { ok: false; error: string };

/**
 * Optional pre-resolved actor — used by the mobile BFF so it does not
 * need to re-derive identity from cookie (Bearer path has no cookie).
 * When omitted, identity is resolved via cookie SSR (web path).
 */
export type ResolvedActor = {
  profileId: string;
  workspaceId: string;
  role: string | null;
};

export async function reportDeviationAction(
  input: ReportDeviationInput,
  actor?: ResolvedActor,
): Promise<ReportDeviationResult> {
  // 1. Validate input
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ugyldig input.",
    };
  }

  // 2. Resolve identity — actor injected by BFF (Bearer path) or derived
  //    from SSR cookie (web path). Never accept workspace_id from body.
  const profile = actor ?? (await resolveCurrentProfile());
  if (!profile) return { ok: false, error: "Ikke autentisert." };

  const admin = createAdminClient();

  // 3. Authority gate (ADR-0099)
  const gate = await gateAction({
    workspaceId: profile.workspaceId,
    capability: "hms.report_deviation_manual",
    channel: parsed.data.channel,
    actorProfileId: profile.profileId,
    actionType: "create",
  });
  if (!gate.allow) {
    return { ok: false, error: gate.reason ?? "Ikke autorisert." };
  }

  // 4. Insert (admin client bypasses RLS — gated above)
  const { data: inserted, error: insertError } = await admin
    .from("deviation")
    .insert({
      workspace_id: profile.workspaceId,
      reported_by: profile.profileId,
      title: parsed.data.title,
      domain: parsed.data.domain,
      severity: parsed.data.severity,
      description: parsed.data.description ?? null,
      department_id: parsed.data.department_id ?? null,
      session_id: parsed.data.session_id ?? null,
      source_task_id: parsed.data.source_task_id ?? null,
      procedure_id: parsed.data.procedure_id ?? null,
      protocol_id: parsed.data.protocol_id ?? null,
      linked_shift_id: parsed.data.linked_shift_id ?? null,
      status: "open",
      requires_action: true,
      blocks_day_approval: parsed.data.severity === "critical",
      payroll_impact: false,
    })
    .select("deviation_id")
    .single();

  if (insertError || !inserted) {
    return {
      ok: false,
      error: insertError?.message ?? "Kunne ikke lagre avvik.",
    };
  }

  // 5. Emit — server-side, awaited (ADR-0134 — all four destinations)
  await emit({
    event: "deviation reported",
    workspace_id: nonEmpty(profile.workspaceId, "workspace_id"),
    actor_id: nonEmpty(profile.profileId, "actor_id"),
    properties: {
      entity: {
        entity_type: "deviation",
        entity_id: inserted.deviation_id,
      },
      data: {
        domain: parsed.data.domain,
        severity: parsed.data.severity,
      },
    },
  });

  return { ok: true, deviationId: inserted.deviation_id };
}
