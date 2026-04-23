import { NextResponse } from "next/server";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit, nonEmpty } from "@smartout/telemetry";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract microservice not configured" }, { status: 503 });
  }

  const res = await callContractService(`/contracts/${id}/send`, {
    method: "POST",
    headers: { "X-User-Id": adminId },
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: body.error ?? "Failed to send contract" },
      { status: res.status },
    );
  }

  await logPlatformAction(adminId, "send_contract", "contract", id, {
    signing_url: body.signing_url,
  });

  void emit({
    event: "contract sent",
    workspace_id: nonEmpty("", "workspace_id"),
    actor_id: nonEmpty(adminId, "actor_id"),
    properties: {
      entity: { entity_type: "contract", entity_id: id },
      data: { recipient_email: "", expires_at: body.expires_at ?? "" },
    },
  });

  return NextResponse.json({ data: body });
}
