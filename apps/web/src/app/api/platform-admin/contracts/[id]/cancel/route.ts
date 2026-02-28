import { NextResponse } from "next/server";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract microservice not configured" }, { status: 503 });
  }

  const res = await callContractService(`/contracts/${id}/cancel`, {
    method: "POST",
    headers: { "X-User-Id": adminId },
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: body.error ?? "Failed to cancel contract" },
      { status: res.status },
    );
  }

  await logPlatformAction(adminId, "cancel_contract", "contract", id, {});

  return NextResponse.json({ data: body });
}
