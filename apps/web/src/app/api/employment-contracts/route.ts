/**
 * POST /api/employment-contracts — Compose a contract draft proposal.
 *
 * Validates the request body, calls resolveComposition to derive employment
 * terms from cascade dimensions (D2 profile, K1a framework rules, K1b binding),
 * and returns the ContractDraftProposal as JSON.
 *
 * When persist=true, the derived proposal is also inserted into employment_contract
 * as a 'draft' row and the resulting contract_id is returned alongside the proposal.
 * When persist=false (default), only the proposal is returned for preview — no DB write.
 *
 * ADR-0076: composition as cascade derivation.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { z } from "zod";
import { resolveComposition, type EmploymentCategory } from "@smartout/utils";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction } from "@/app/dashboard/_actions/_shared";

// ADR-0151 forgery fix: workspace_id REMOVED from schema — derived from JWT actorProfile.
// SMA-311: profile_id kept in body (the target employee, not the actor).
const composeSchema = z.object({
  profile_id: z.string().uuid(),
  // Employment terms — feed directly into resolveComposition as CompositionInput
  position_title: z.string().min(1).optional().default(""),
  employment_category: z.enum(["fast", "deltid", "tilkalling"]).optional().default("fast"),
  employment_percentage: z.number().min(1).max(100).optional().default(100),
  employee_group_id: z.string().uuid().optional(),
  // When true, persist the derived proposal to employment_contract table
  persist: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// POST /api/employment-contracts
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = composeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      profile_id,
      position_title,
      employment_category,
      employment_percentage,
      employee_group_id,
      persist,
    } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── ADR-0151 forgery fix: derive workspace_id from JWT, not body ──────
    // Actor profile row is the source of truth for workspace_id.
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, workspace_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!actorProfile) {
      return NextResponse.json({ error: "No active profile found" }, { status: 403 });
    }

    // workspace_id is now server-derived — never from body
    const workspace_id = actorProfile.workspace_id;

    // ── Role gate: require admin or owner ─────────────────────────────
    if (!["admin", "owner"].includes(actorProfile.role ?? "")) {
      return NextResponse.json(
        { error: "Forbidden: admin or owner role required" },
        { status: 403 },
      );
    }

    // ── SMA-311 / ADR-0309: C4 gateAction — authority enforcement ────────
    const gateResult = await gateAction({
      workspaceId: workspace_id,
      capability: "contract",
      channel: "system",
      actorProfileId: actorProfile.profile_id,
      actionType: "compose",
      entityId: profile_id,
    });

    if (!gateResult.allow) {
      void emit({
        event: "gate.contract_send_denied",
        workspace_id: nonEmpty(workspace_id, "workspace_id"),
        actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
        properties: {
          entity: { entity_type: "employment_contract", entity_id: profile_id },
          data: {
            contract_id: profile_id,
            capability: "contract",
            action_type: "compose",
            reason: gateResult.reason,
            denied_by: "gate_action",
          },
        },
      });
      return NextResponse.json(
        { error: "gate_denied", reason: gateResult.reason, denied_by: "gate_action" },
        { status: 403 },
      );
    }

    const proposal = await resolveComposition(supabase, workspace_id, profile_id, {
      employment_category: employment_category as EmploymentCategory,
      employment_percentage,
      position_title,
      employee_group_id,
    });

    // ── Preview mode: return the proposal without writing to DB ────────
    if (!persist) {
      return NextResponse.json(proposal);
    }

    // ── Persist mode: insert a draft employment_contract row ───────────
    const { employment_terms } = proposal;

    const { data: contract, error: insertError } = await supabase
      .from("employment_contract")
      .insert({
        workspace_id,
        profile_id,
        status: "draft",
        position_title: employment_terms.position_title,
        employment_category: employment_terms.employment_category,
        employment_form: "permanent",
        employment_percentage: employment_terms.employment_percentage,
        hourly_rate: employment_terms.hourly_rate,
        monthly_salary: employment_terms.monthly_salary,
        start_date: employment_terms.start_date,
        created_by: actorProfile.profile_id,
      })
      .select("contract_id")
      .single();

    if (insertError || !contract) {
      throw new Error(`Failed to persist contract: ${insertError?.message ?? "unknown error"}`);
    }

    await emit({
      event: "contract created",
      workspace_id: nonEmpty(workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: { entity_type: "employment_contract", entity_id: contract.contract_id },
        data: { template_id: "", recipient_email: "", contract_type: "employee" },
      },
    });

    return NextResponse.json({ ...proposal, contract_id: contract.contract_id, persisted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
