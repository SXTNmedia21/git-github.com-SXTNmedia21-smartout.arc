/**
 * POST /api/contracts/[id]/amend — propose a contract amendment.
 *
 * What: Receives field changes for an employment_contract, classifies them
 *       (MATERIAL/ADMIN/DERIVED/SYSTEM), computes constructive dismissal risk,
 *       and creates a contract_amendment row.
 *
 * Why: Journey 5 (amendment flow). ADR-0244: `requires_employee_signature`
 *      determined by MATERIAL classification; `is_constructive_dismissal_risk`
 *      by Aml. §15-7 compound condition (job_title + tariff/hours/salary drop ≥20%).
 *
 * DB schema (database.types.ts): contract_amendment.contract_id (not parent_contract_id).
 * Status enum: pending | pending_employee_signature | accepted | rejected | expired.
 * field_changes: Json. change_summary: string. created_by_user_id: string (required).
 *
 * ADR-0151 forgery defence: workspace_id resolved from JWT (auth.getUser() +
 * profile lookup), never from request body. contract_id from URL param.
 * Profile ownership verified: contract must belong to caller's workspace.
 *
 * Returns: { amendment_id, requires_employee_signature, is_constructive_dismissal_risk, classifications }
 *
 * Telemetry: contract.amendment_proposed (Wave 3 registry).
 *
 * ESKALÉR: is_constructive_dismissal_risk threshold (20%) is an interpretation
 * of Aml. §15-7 "vesentlig endring" — arbeidsrettsadvokat review required before go-live.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { classifyBatch } from "@smartout/contracts";
import type { Json } from "@smartout/supabase/database.types";

// ─── Request schema ──────────────────────────────────────────────────────────

const FieldChangeSchema = z.object({
  column: z.string().min(1),
  from: z.unknown(),
  to: z.unknown(),
});

const AmendBodySchema = z.object({
  field_changes: z.array(FieldChangeSchema).min(1, "At least one field change is required."),
  /** Optional free-text reason for the amendment (shown to employee). */
  reason: z.string().optional(),
});

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: contractId } = await params;

  // ── Auth (ADR-0151 step 1: workspace from JWT) ───────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve workspace_id from profile (JWT → profile → workspace_id).
  const { data: callerProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!callerProfile?.workspace_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  // Only admin or owner can propose amendments.
  if (!["admin", "owner"].includes(callerProfile.role)) {
    return NextResponse.json(
      { error: "Kun admin eller eier kan foreslå kontraktsendringer." },
      { status: 403 },
    );
  }

  const workspaceId = callerProfile.workspace_id;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AmendBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { field_changes, reason } = parsed.data;

  // ── Load original contract (ADR-0151 step 2: ownership verified) ─────────
  const admin = createAdminClient();
  const { data: originalContract, error: contractErr } = await admin
    .from("employment_contract")
    .select("contract_id, profile_id, workspace_id, status")
    .eq("contract_id", contractId)
    .eq("workspace_id", workspaceId) // workspace_id from JWT — not from body
    .maybeSingle();

  if (contractErr || !originalContract) {
    return NextResponse.json({ error: "Kontrakt ikke funnet i dette workspace." }, { status: 404 });
  }

  if (originalContract.status !== "signed" && originalContract.status !== "active") {
    return NextResponse.json(
      { error: "Kun signerte kontrakter kan ha amendment. Status: " + originalContract.status },
      { status: 400 },
    );
  }

  // ── Classify changes ──────────────────────────────────────────────────────
  const changesRecord: Record<string, { from: unknown; to: unknown }> = {};
  for (const fc of field_changes) {
    changesRecord[fc.column] = { from: fc.from, to: fc.to };
  }

  const classification = classifyBatch(changesRecord);

  // ── Build field_changes JSON for DB ──────────────────────────────────────
  const now = new Date().toISOString();
  // Serialize to plain JSON to satisfy Supabase's recursive Json type.
  const fieldChangesJson: Json = JSON.parse(
    JSON.stringify(
      field_changes.map((fc) => ({
        column: fc.column,
        from: fc.from ?? null,
        to: fc.to ?? null,
        classification:
          changesRecord[fc.column] !== undefined
            ? (classification.changes.find((c) => c.column === fc.column)?.classification ??
              "system")
            : "system",
      })),
    ),
  ) as Json;

  const changeSummaryStr = reason
    ? `Amendment: ${field_changes.map((fc) => fc.column).join(", ")}. Reason: ${reason}`
    : `Amendment: ${field_changes.map((fc) => fc.column).join(", ")}`;

  // ── Insert contract_amendment (DB schema: contract_id, not parent_contract_id) ──
  const { data: newAmendment, error: amendErr } = await admin
    .from("contract_amendment")
    .insert({
      contract_id: contractId,
      workspace_id: workspaceId,
      created_by_user_id: user.id,
      change_summary: changeSummaryStr,
      field_changes: fieldChangesJson,
      requires_employee_signature: classification.requires_employee_signature,
      is_constructive_dismissal_risk: classification.is_constructive_dismissal_risk,
      status: classification.requires_employee_signature ? "pending_employee_signature" : "pending",
      amendment_date: now.slice(0, 10),
      created_at: now,
      updated_at: now,
      acknowledged_constructive_dismissal_risk: !classification.is_constructive_dismissal_risk,
    })
    .select("id")
    .single();

  if (amendErr || !newAmendment) {
    console.error("[/api/contracts/[id]/amend] amendment insert failed:", amendErr?.message);
    return NextResponse.json(
      { error: "Kunne ikke opprette amendment.", detail: amendErr?.message },
      { status: 500 },
    );
  }

  // ── Telemetry ─────────────────────────────────────────────────────────────
  void emit({
    event: "contract.amendment_proposed",
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(callerProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract" as const, entity_id: contractId },
      data: {
        amendment_id: newAmendment.id,
        contract_id: contractId,
        classification: classification.worst_classification,
        requires_employee_signature: classification.requires_employee_signature,
        is_constructive_dismissal_risk: classification.is_constructive_dismissal_risk,
        changed_fields: field_changes.map((fc) => fc.column),
      },
    },
  });

  // ── Response ──────────────────────────────────────────────────────────────
  return NextResponse.json({
    amendment_id: newAmendment.id,
    contract_id: contractId,
    requires_employee_signature: classification.requires_employee_signature,
    is_constructive_dismissal_risk: classification.is_constructive_dismissal_risk,
    worst_classification: classification.worst_classification,
    classifications: classification.changes.map((c) => ({
      column: c.column,
      classification: c.classification,
      requires_employee_signature: c.requires_employee_signature,
      is_constructive_dismissal_risk: c.is_constructive_dismissal_risk,
      label_nb: c.label_nb,
    })),
    material_fields: classification.material_fields,
    admin_fields: classification.admin_fields,
  });
}
