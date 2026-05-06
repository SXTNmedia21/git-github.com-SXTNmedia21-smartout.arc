/**
 * POST /api/contracts/[id]/sign-dev — Dev-only contract signing stub.
 *
 * What: Marks an employment_contract and its linked contract row as signed
 *       without going through DocuSeal. Also updates signed_at timestamps.
 *
 * Why: Enables E2E tests in dev/CI environments where DocuSeal / contract-
 *      service is not running. The Walt sign-dev page calls this endpoint.
 *
 * Security gates:
 *   - 404 when CONTRACT_SERVICE_URL is configured (production guard)
 *   - 401 when not authenticated
 *   - 409 when contract is already signed
 *   - RLS enforced via Supabase client (user-scoped JWT)
 *
 * The [id] param is the employment_contract.contract_id (not contract.contract_id).
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

function isContractServiceConfigured(): boolean {
  const url = process.env.CONTRACT_SERVICE_URL;
  return Boolean(url && url.trim().length > 0);
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Production guard — sign-dev is only available in dev mode
  if (isContractServiceConfigured()) {
    return NextResponse.json(
      { error: "sign-dev endpoint disabled in production" },
      { status: 404 },
    );
  }

  const { id: contractId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
  }

  // Fetch employment_contract (RLS ensures user can only see their own)
  const { data: empContract, error: fetchErr } = await supabase
    .from("employment_contract")
    .select("contract_id, status, signing_contract_id, workspace_id")
    .eq("contract_id", contractId)
    .single();

  if (fetchErr || !empContract) {
    return NextResponse.json({ error: "Kontrakt ikke funnet" }, { status: 404 });
  }

  // Gate: already signed
  if (empContract.status === "signed") {
    return NextResponse.json({ error: "cannot sign: contract already signed" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();

  // Update employment_contract → signed
  const { error: empUpdateErr } = await admin
    .from("employment_contract")
    .update({
      status: "signed",
      signed_at: now,
      updated_at: now,
    } as never)
    .eq("contract_id", contractId);

  if (empUpdateErr) {
    return NextResponse.json(
      { error: `Kunne ikke oppdatere kontrakt: ${empUpdateErr.message}` },
      { status: 500 },
    );
  }

  // Also update linked contract row if present
  if (empContract.signing_contract_id) {
    await admin
      .from("contract")
      .update({
        status: "signed",
        signed_at: now,
        updated_at: now,
      } as never)
      .eq("contract_id", empContract.signing_contract_id);
  }

  // Emit telemetry — registry shape: data carries recipient_email + signed_pdf_url only
  void emit({
    event: "contract signed",
    workspace_id: nonEmpty(empContract.workspace_id, "workspace_id"),
    actor_id: nonEmpty(user.id, "actor_id"),
    properties: {
      entity: { entity_type: "contract", entity_id: contractId },
      data: { recipient_email: user.email ?? "" },
    },
  });

  return NextResponse.json({
    data: {
      contract_id: contractId,
      status: "signed",
      signed_at: now,
    },
  });
}
