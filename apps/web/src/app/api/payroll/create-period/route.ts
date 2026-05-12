/**
 * POST /api/payroll/create-period
 *
 * Admin/manager creates a new payroll.period for the workspace. SMA-343 S1a.
 *
 * Pipeline:
 *   1. rejectCrossOrigin
 *   2. Input validation (Zod) — workspace_id + date range
 *   3. resolvePayrollAuth — server-derives workspace_id + profile_id from JWT
 *   4. gateAction — admin role required
 *   5. INSERT payroll.period with status='open'
 *   6. emit payroll.period_created
 *
 * Returns: { ok: true, period_id: string, status: 'open' }
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0151 — workspace_id derived server-side via resolvePayrollAuth (Path B:
 *               caller supplies workspace_id for validation only; auth derives it).
 *               NEVER trust body workspace_id as identity; resolvePayrollAuth
 *               validates the authenticated user has a profile in that workspace.
 *   ADR-0204 — gateAction before write (admin-only action)
 *   ADR-0134 — emit() with nonEmpty workspace_id + actor_id
 *   L-0177   — fail fast on profile-not-found (resolvePayrollAuth returns null → 401)
 *   L-0176   — body implemented before this docstring was written
 *   ADR-0078 — payroll = Høy-PII; channel pinned to "chat" at BFF layer
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { gateAction } from "@/app/dashboard/_actions/_shared";
import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";

export const runtime = "nodejs";

// workspace_id is accepted in the body ONLY for resolvePayrollAuth workspace-validation
// (Path B per ADR-0151). It is NOT used as the effective workspace_id — that is
// always taken from auth.workspaceId (server-derived). Zod validates format only.
const RequestSchema = z
  .object({
    workspace_id: z
      .string()
      .uuid()
      .describe("Workspace context for auth validation (Path B ADR-0151)"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "start_date must be YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "end_date must be YYYY-MM-DD"),
  })
  .refine((d) => d.start_date < d.end_date, {
    message: "start_date must be before end_date",
    path: ["start_date"],
  });

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ─────────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Input validation ────────────────────────────────────────────────────────
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    const message =
      err instanceof z.ZodError ? (err.errors[0]?.message ?? "Invalid body") : "Invalid body";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  // ─── Identity (ADR-0151 Path B: validate user has profile in requested workspace) ──
  const auth = await resolvePayrollAuth(request, body.workspace_id);
  if (!auth) {
    // L-0177: fail fast — no silent fallback. null = no profile in this workspace.
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // ─── Authority gate (ADR-0204, ADR-0078) ─────────────────────────────────────
  // Channel pinned to "chat" — payroll is Høy-PII (ADR-0078).
  const gate = await gateAction({
    workspaceId: auth.workspaceId,
    capability: "payroll",
    channel: "chat",
    actorProfileId: auth.profileId,
    actionType: "create_period",
  });
  if (!gate.allow) {
    return NextResponse.json(
      { ok: false, error: `forbidden: ${gate.reason ?? "denied"}` },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  // ─── INSERT payroll.period ────────────────────────────────────────────────────
  // workspace_id comes from auth (server-derived), NOT body — ADR-0151.
  // status defaults to 'open' per the schema default; explicit for clarity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: period, error: insertErr } = await (admin.schema("payroll") as any)
    .from("period")
    .insert({
      workspace_id: auth.workspaceId,
      start_date: body.start_date,
      end_date: body.end_date,
      status: "open",
    })
    .select("id")
    .single();

  if (insertErr) {
    // PostgreSQL UNIQUE violation — duplicate (workspace_id, start_date, end_date)
    if ((insertErr as { code?: string }).code === "23505") {
      return NextResponse.json(
        {
          ok: false,
          error: "duplicate_period",
          detail: "Periode finnes allerede for disse datoene",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "db_error", detail: (insertErr as { message?: string }).message },
      { status: 500 },
    );
  }

  const periodId = String((period as { id: string }).id);

  // ─── Telemetry (ADR-0134) ─────────────────────────────────────────────────────
  // Fire-and-forget — emit failure must not mask the success response.
  void emit({
    event: "payroll.period_created",
    workspace_id: nonEmpty(auth.workspaceId, "workspaceId"),
    actor_id: nonEmpty(auth.profileId, "profileId"),
    properties: {
      entity: { entity_type: "payroll_period" as const, entity_id: periodId },
      data: {
        start_date: body.start_date,
        end_date: body.end_date,
      },
    },
  });

  return NextResponse.json({ ok: true, period_id: periodId, status: "open" });
}
