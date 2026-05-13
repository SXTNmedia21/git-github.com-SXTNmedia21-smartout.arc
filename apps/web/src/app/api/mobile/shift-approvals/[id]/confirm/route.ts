/**
 * BFF /api/mobile/shift-approvals/[id]/confirm — mobile confirms a shift_approval (hours).
 *
 * Per ADR-0132 + ADR-0151 + Spec §4.1:
 * - Bearer JWT only
 * - Body MUST be empty (strict schema rejects unknown keys)
 * - Identity derived from JWT via resolveMobileActor (no body fields)
 * - Delegates to confirmHoursAction with channel='system'
 *
 * References: ADR-0078, ADR-0099, ADR-0114, ADR-0132, ADR-0134,
 *             ADR-0151, ADR-0266, ADR-0298.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveMobileActor } from "../../../_shared/actor";
import { confirmHoursAction } from "@/app/dashboard/_actions/confirm-hours-action";

export const runtime = "nodejs";

// Strict empty-body schema — rejects ALL unknown keys per ADR-0151.
const RequestSchema = z.object({}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Validate path param via z.string().uuid() (NOT loose regex).
  const { id: approvalId } = await params;
  if (!z.string().uuid().safeParse(approvalId).success) {
    return NextResponse.json({ ok: false, error: "Ugyldig timeoppgjør-ID" }, { status: 422 });
  }

  // 2. Bearer auth.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!bearerToken) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const actor = await resolveMobileActor(bearerToken);
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 3. Parse body — strict empty object.
  let bodyRaw: unknown = {};
  try {
    const text = await request.text();
    bodyRaw = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Ugyldig JSON" }, { status: 422 });
  }
  const parsed = RequestSchema.safeParse(bodyRaw);
  if (!parsed.success) {
    const path = parsed.error.errors[0]?.path.join(".") ?? "ukjent";
    return NextResponse.json(
      { ok: false, error: `Body inneholder ulovlige felt: ${path}` },
      { status: 422 },
    );
  }

  // 4. Delegate.
  const result = await confirmHoursAction(approvalId, actor, "system");
  if (result.ok === false) {
    const isAuth =
      result.error.startsWith("Ikke autorisert") || result.error.includes("annet arbeidsrom");
    return NextResponse.json({ ok: false, error: result.error }, { status: isAuth ? 403 : 422 });
  }
  return NextResponse.json({ ok: true, approvalId: result.approvalId }, { status: 200 });
}
