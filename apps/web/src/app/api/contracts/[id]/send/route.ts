// POST /api/contracts/[id]/send — send a draft employee contract via the contract microservice
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit } from "@smartout/telemetry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("contract")
    .select("contract_id, status, workspace_id")
    .eq("contract_id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only draft contracts can transition to sent
  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const res = await callContractService(`/contracts/${id}/send`, {
    method: "POST",
    headers: { "X-User-Id": user.id },
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: body.error ?? "Failed to send contract" },
      { status: res.status },
    );
  }

  void emit({
    event: "contract sent",
    workspace_id: contract.workspace_id ?? "",
    actor_id: user.id,
    properties: {
      entity: { entity_type: "contract", entity_id: id },
      data: { recipient_email: "", expires_at: body.expires_at ?? "" },
    },
  });

  return NextResponse.json({ data: body });
}
