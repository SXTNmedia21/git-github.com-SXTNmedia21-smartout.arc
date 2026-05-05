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
const composeSchema = z.object({
  workspace_id: z.string().uuid(),
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
      workspace_id,
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

    // ── Role gate: require admin or owner ─────────────────────────────
    const { data: actorProfile } = await supabase
      .from("profile")
      .select("profile_id, role")
      .eq("user_id", user.id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
      return NextResponse.json(
        { error: "Forbidden: admin or owner role required" },
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
