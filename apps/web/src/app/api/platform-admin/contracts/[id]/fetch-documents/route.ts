import { NextResponse } from "next/server";
import { getSuperAdminId } from "@/lib/platform-admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract microservice not configured" }, { status: 503 });
  }

  const res = await callContractService(`/contracts/${id}/fetch-documents`, {
    method: "POST",
    headers: { "X-User-Id": adminId },
  });

  const body = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: body.error ?? "Failed to fetch documents" },
      { status: res.status },
    );
  }

  return NextResponse.json({ data: body });
}
