/**
 * POST /api/contracts/[id]/local-sign — Local-dev signing stub.
 *
 * What: Directly updates contract + employment_contract DB rows to simulate
 *       DocuSeal signing without any outbound webhook calls. Supports
 *       employer + employee roles independently so both can sign in sequence.
 *
 * Why: DocuSeal webhooks cannot reach localhost, so the sign flow gets stuck
 *      on "venter på din signatur". This endpoint lets developers complete the
 *      full signing cycle in local Supabase without a public-facing URL.
 *
 * Security gates (in order):
 *   1. 403 when CONTRACT_LOCAL_SIGN_MODE is not "true" — prod-abuse prevention.
 *   2. Token + contract-id pair must match in the contract table — 404 if not.
 *   3. Role must be "employer" or "employee" — 400 otherwise.
 *   4. Employee cannot sign before employer — 400 with explicit reason.
 *
 * The [id] param is contract.contract_id (the signing entity, NOT employment_contract.contract_id).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { env } from "@/env";

const bodySchema = z.object({
  role: z.enum(["employer", "employee"]),
  token: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Gate 1 — only available when local-sign-mode is explicitly enabled.
  // SECURITY-CRITICAL: prevents production abuse if route accidentally deploys.
  if (env.CONTRACT_LOCAL_SIGN_MODE !== "true") {
    return NextResponse.json({ error: "Local sign mode disabled" }, { status: 403 });
  }

  const { id: contractId } = await params;
  const admin = createAdminClient();

  // Parse and validate body
  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig forespørsel" }, { status: 400 });
  }
  const { role, token } = parsed.data;

  // Gate 2 — verify token matches this contract_id
  const { data: contract } = await admin
    .from("contract")
    .select("contract_id, signing_url, status, workspace_id")
    .eq("contract_id", contractId)
    .eq("signing_url", token)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json({ error: "Kontrakt ikke funnet" }, { status: 404 });
  }

  // Already fully signed — idempotent early return
  if (contract.status === "signed") {
    return NextResponse.json({ success: true, role, all_signed: true }, { status: 200 });
  }

  // Find linked employment_contract (the source of per-role timestamps)
  const { data: empContract } = await admin
    .from("employment_contract")
    .select(
      "contract_id, status, signed_by_employer_at, signed_by_employee_at, signing_contract_id, workspace_id",
    )
    .eq("signing_contract_id", contractId)
    .maybeSingle();

  // It's valid to have no employment_contract (e.g. standalone contracts).
  // We still update the contract table; we just skip the emp-contract update.

  const now = new Date().toISOString();

  if (role === "employer") {
    // Mark employer signed on employment_contract
    if (empContract) {
      await admin
        .from("employment_contract")
        .update({ signed_by_employer_at: now, updated_at: now } as never)
        .eq("contract_id", empContract.contract_id);
    }

    // Insert contract_event
    await admin.from("contract_event").insert({
      contract_id: contractId,
      actor_type: "local_dev",
      event_type: "form_completed",
      workspace_id: contract.workspace_id,
      details: {
        role,
        signing_token_suffix: token.slice(-4),
      },
    });

    const employerSignedAt = now;
    const employeeSignedAt = empContract?.signed_by_employee_at ?? null;

    return NextResponse.json({
      success: true,
      role,
      all_signed: false,
      employer_signed_at: employerSignedAt,
      employee_signed_at: employeeSignedAt,
    });
  }

  // role === "employee"

  // Gate 4 — employer must sign first
  const employerSignedAt = empContract?.signed_by_employer_at ?? null;
  if (!employerSignedAt) {
    return NextResponse.json({ error: "Lederen må signere først" }, { status: 400 });
  }

  const employeeSignedAt = now;

  // Update employment_contract: employee timestamp + both signed → active
  if (empContract) {
    await admin
      .from("employment_contract")
      .update({
        signed_by_employee_at: now,
        signed_at: now,
        status: "active",
        updated_at: now,
      } as never)
      .eq("contract_id", empContract.contract_id);
  }

  // Update contract row: fully signed
  await admin
    .from("contract")
    .update({
      status: "signed",
      signed_at: now,
      updated_at: now,
    } as never)
    .eq("contract_id", contractId);

  // Insert contract_event
  await admin.from("contract_event").insert({
    contract_id: contractId,
    actor_type: "local_dev",
    event_type: "form_completed",
    workspace_id: contract.workspace_id,
    details: {
      role,
      signing_token_suffix: token.slice(-4),
    },
  });

  return NextResponse.json({
    success: true,
    role,
    all_signed: true,
    employer_signed_at: employerSignedAt,
    employee_signed_at: employeeSignedAt,
  });
}
