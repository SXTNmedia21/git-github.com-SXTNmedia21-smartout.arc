// POST /api/contracts/[id]/cancel — cancel an employee contract via the contract microservice
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit, nonEmpty } from "@smartout/telemetry";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch contract to get workspace_id for telemetry — also implicitly verifies RLS access
  const { data: contract } = await supabase
    .from("contract")
    .select("contract_id, workspace_id")
    .eq("contract_id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Dev fallback when contract microservice is not configured: update DB
  // directly so admin can cancel locally without DocuSeal integration. In
  // prod this branch is skipped — the microservice handles webhook + DB.
  if (!isContractServiceConfigured()) {
    const { error: updateErr } = await supabase
      .from("contract")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("contract_id", id);
    if (updateErr) {
      return NextResponse.json(
        { error: `Kunne ikke avbryte kontrakt lokalt: ${updateErr.message}` },
        { status: 500 },
      );
    }
  } else {
    const res = await callContractService(`/contracts/${id}/cancel`, {
      method: "POST",
      headers: { "X-User-Id": user.id },
    });

    const body = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: body.error ?? "Failed to cancel contract" },
        { status: res.status },
      );
    }
  }

  void emit({
    event: "contract cancelled",
    workspace_id: nonEmpty(contract.workspace_id, "workspace_id"),
    actor_id: nonEmpty(user.id, "actor_id"),
    properties: {
      entity: { entity_type: "contract", entity_id: id },
      data: {},
    },
  });

  return NextResponse.json({ data: { contract_id: id, status: "cancelled" } });
}
