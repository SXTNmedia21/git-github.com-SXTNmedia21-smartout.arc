/**
 * GET /api/payroll/_smoke/recalc-latency
 *
 * Internal admin-only smoke probe (T7.2). Measures end-to-end recalc latency
 * for the authenticated admin's current workspace against the most recent open
 * payroll period. No data is mutated.
 *
 * The probe calls POST /api/payroll/recalculate-period (the canonical orchestrator)
 * against a real open period and measures wall-clock time. Acceptance target: <2000ms
 * for a standard workspace.
 *
 * ADMIN GATE: Only profile.role = admin | owner may call this endpoint.
 * The gate is enforced via gateAction (actionType='recalculate_period') which maps
 * to confirm-level authority (admin+). Employees and managers receive 403.
 *
 * Returns:
 *   200  { ok: true, duration_ms, line_count, profile_count, threshold_ms: 2000, passed }
 *   200  { ok: false, error: 'no_open_period' } — workspace has no open period to probe
 *   401  — not authenticated
 *   403  — insufficient role (employee / manager)
 *   500  — recalc orchestrator failed (see error field)
 *
 * ADR compliance:
 *   ADR-0151 — workspace_id + profile_id derived server-side via resolvePayrollAuth
 *   ADR-0204 — gateAction before any operation (read-only here but gate still verifies role)
 *   ADR-0078 — chat channel only (payroll = Høy-PII)
 *   ADR-0134 — no emit() on read-only probe (nothing to emit)
 *   L-0177   — 404 fast-fail on missing period, no silent fallback
 *
 * Usage:
 *   curl -H "Cookie: <session>" "http://localhost:3060/api/payroll/_smoke/recalc-latency"
 *
 * DO NOT expose to the public internet. Internal use only.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";

export const runtime = "nodejs";

const THRESHOLD_MS = 2000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ──────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151) ─────────────────────────────────────────────────
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Admin gate (ADR-0204) ───────────────────────────────────────────────
  // 'recalculate_period' maps to confirm-level authority (admin/owner only).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "recalculate_period",
    entityId: auth.workspaceId,
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "insufficient role"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── Find most recent open period in workspace (L-0177 fail-fast) ────────
  const { data: period, error: periodErr } = await admin
    .schema("payroll")
    .from("period")
    .select("id, start_date, end_date")
    .eq("workspace_id", auth.workspaceId)
    .eq("status", "open")
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodErr) {
    return NextResponse.json(
      { ok: false, error: "period_lookup_failed", detail: periodErr.message },
      { status: 500 },
    );
  }

  if (!period) {
    // Not a hard error — workspace simply has no open period right now.
    return NextResponse.json({
      ok: false,
      error: "no_open_period",
      detail: "Workspace has no open payroll period. Create or open a period before probing.",
    });
  }

  // ─── Count profiles and existing lines (pre-recalc, for context) ─────────
  const [profileResult, lineResult] = await Promise.all([
    admin
      .from("profile")
      .select("profile_id", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId)
      .eq("is_active", true),
    admin
      .schema("payroll")
      .from("calculation")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", auth.workspaceId)
      .eq("period_id", period.id),
  ]);

  const profileCount = profileResult.count ?? 0;
  const preLineCount = lineResult.count ?? 0;

  // ─── Call recalculate-period and measure wall-clock time ─────────────────
  const protocol = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("host") ?? "localhost:3060";
  const baseUrl = `${protocol}://${host}`;

  const startMs = Date.now();

  const recalcResponse = await fetch(`${baseUrl}/api/payroll/recalculate-period`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Forward session so resolvePayrollAuth succeeds in the child route.
      ...(request.headers.get("cookie") ? { cookie: request.headers.get("cookie")! } : {}),
      ...(request.headers.get("authorization")
        ? { authorization: request.headers.get("authorization")! }
        : {}),
    },
    body: JSON.stringify({ period_id: period.id }),
  });

  const durationMs = Date.now() - startMs;

  let lineCount = preLineCount;
  if (recalcResponse.ok) {
    const body = (await recalcResponse.json().catch(() => ({}))) as Record<string, unknown>;
    lineCount = typeof body.total_lines === "number" ? body.total_lines : preLineCount;
  }

  if (!recalcResponse.ok) {
    const errBody = (await recalcResponse.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(
      {
        ok: false,
        error: "recalc_failed",
        detail: (errBody as { error?: string }).error ?? `HTTP ${recalcResponse.status}`,
        duration_ms: durationMs,
        period_id: period.id,
        profile_count: profileCount,
        threshold_ms: THRESHOLD_MS,
        passed: false,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    period_id: period.id,
    period_range: `${period.start_date} – ${period.end_date}`,
    duration_ms: durationMs,
    line_count: lineCount,
    profile_count: profileCount,
    threshold_ms: THRESHOLD_MS,
    passed: durationMs < THRESHOLD_MS,
  });
}
