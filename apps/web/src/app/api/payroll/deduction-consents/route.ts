/**
 * BFF GET /api/payroll/deduction-consents
 *
 * Returns active payroll.consent_document rows for a given employee profile.
 * Used by LineOverrideModal to populate the consent picker when category='deduction'.
 *
 * ADR-0151 — workspaceId is server-derived from JWT; only profileId accepted from client.
 *             Never expose workspaceId as query param.
 * ADR-0078 — payroll = Høy-PII; validates profile belongs to JWT workspace before returning.
 * L-0177   — profile not found in JWT workspace → 404. No silent empty response.
 *
 * Response: { ok: true, consents: ConsentDocumentRow[] }
 * ConsentDocumentRow: { id, consent_type, signed_at, signed_document_url, expires_at }
 *
 * L-0176: body verified first, docstring describes implemented body.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── Input: profileId only (workspaceId is server-derived) ───────────────
  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId || !/^[0-9a-f-]{36}$/i.test(profileId)) {
    return NextResponse.json(
      { ok: false, error: "profileId is required and must be a UUID" },
      { status: 400 },
    );
  }

  // ─── Identity (ADR-0151: server-derived workspace) ────────────────────────
  // resolvePayrollAuth resolves workspaceId from JWT cookie or Bearer token.
  // No requestedWorkspaceId passed — picks authenticated user's workspace.
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ─── Validate profile belongs to JWT workspace (ADR-0151, L-0177) ─────────
  const { data: profileRow, error: profileErr } = await admin
    .from("profile")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("workspace_id", auth.workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  if (profileErr || !profileRow) {
    // L-0177: fail fast — profile not in JWT workspace means caller is asking about
    // someone they can't see. 404 (not 403) avoids leaking whether the profile exists.
    return NextResponse.json(
      { ok: false, error: "profile_not_found_in_workspace" },
      { status: 404 },
    );
  }

  // ─── Fetch active consent documents for employee ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: consents, error: consentErr } = await (admin.schema("payroll") as any)
    .from("consent_document")
    .select("consent_document_id, consent_type, signed_at, signed_document_url, expires_at")
    .eq("employee_profile_id", profileId)
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "active")
    .order("signed_at", { ascending: false });

  if (consentErr) {
    return NextResponse.json({ ok: false, error: "consent_fetch_failed" }, { status: 500 });
  }

  // ─── Response ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    ok: true,
    consents: (consents ?? []).map(
      (c: {
        consent_document_id: string;
        consent_type: string;
        signed_at: string;
        signed_document_url: string;
        expires_at: string | null;
      }) => ({
        id: c.consent_document_id,
        consent_type: c.consent_type,
        signed_at: c.signed_at,
        signed_document_url: c.signed_document_url,
        expires_at: c.expires_at,
      }),
    ),
  });
}
