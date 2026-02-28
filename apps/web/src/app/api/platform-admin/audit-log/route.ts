import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";

const AuditLogSchema = z.object({
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable(),
  details: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = AuditLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action, entityType, entityId, details } = parsed.data;
  await logPlatformAction(adminId, action, entityType, entityId, details ?? {});

  return NextResponse.json({ ok: true });
}
