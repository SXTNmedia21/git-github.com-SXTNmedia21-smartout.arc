/**
 * POST /api/payroll/tariff/supplement
 *
 * BFF route — add a workspace-specific supplement rule above the tariff floor.
 * Wraps payroll.add_supplement_override capability tool (tariff-tools.ts).
 *
 * This route is HTTP-shaped glue only. All business logic lives in
 * addSupplementOverrideTool.execute(), which encodes:
 *   - L-0177 fail-fast (workspaceId + profileId non-empty from ctx)
 *   - Chat-channel guard (ADR-0078 Høy-PII)
 *   - Cross-workspace block (ADR-0151)
 *   - gatedMutation payroll authority gate (ADR-0204 + ADR-0287)
 *   - cascade.add_supplement_rule delegation (ADR-0356)
 *   - PostgreSQL tariff-floor trigger (SUPPLEMENT_BELOW_TARIFF_FLOOR with aml_ref)
 *   - Dual-layer audit emit (ADR-0356 audit-symmetry)
 *
 * Phase 7g reconciliation: CONTRACT GAPS closed.
 *   supplement_type: contract now uses DB taxonomy (normal/week_based/day_based/…).
 *   rate_type: contract now uses DB values (fixed_per_hour/percentage/fixed_per_shift).
 *   No translation layers — body values passed directly to tool.
 *   audit block: real payroll_emit_id + cascade_emit_id from tool (uuid-before-emit).
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — channel forced "chat" in synthetic ctx; tool enforces defence-in-depth.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from body).
 *   ADR-0152  — all errors use payrollTariffErrorSchema; SUPPLEMENT_BELOW_TARIFF_FLOOR
 *               passes through with aml_ref + floor + proposed (ADR-0152 ext fields).
 *   ADR-0356  — audit block carries actor_capability='payroll', delegated_via='cascade'.
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { addSupplementOverrideTool } from "@smartout/ai/capabilities/payroll/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";
import {
  addSupplementRequestSchema,
  payrollTariffErrorCodeSchema,
  type PayrollTariffErrorCode,
  type AddSupplementResponse,
} from "@smartout/types";

export const runtime = "nodejs";

function toErrorCode(raw: string): PayrollTariffErrorCode {
  const parsed = payrollTariffErrorCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "BFF_INTERNAL_ERROR";
}

function toStatus(code: PayrollTariffErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
    case "MISSING_PROFILE_CONTEXT":
      return 401;
    case "SUPPLEMENT_BELOW_TARIFF_FLOOR":
      return 422;
    case "INVALID_WORKSPACE":
    case "CROSS_WORKSPACE_BLOCKED":
      return 403;
    case "AMENDMENT_BLOCKED":
      return 422;
    default:
      return 500;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Parse + validate body ────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    const resp: AddSupplementResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Body must be valid JSON" },
    };
    return NextResponse.json(resp, { status: 400 });
  }

  const parsed = addSupplementRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const resp: AddSupplementResponse = {
      ok: false,
      error: {
        code: "BFF_INTERNAL_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid request body",
      },
    };
    return NextResponse.json(resp, { status: 400 });
  }

  const body = parsed.data;

  // ─── Identity (ADR-0151: server-derived, never from body) ────────────────
  // L-0177: null → 401 UNAUTHORIZED.
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    const resp: AddSupplementResponse = {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required (L-0177)" },
    };
    return NextResponse.json(resp, { status: 401 });
  }

  // ─── Build synthetic AgentToolContext (ADR-0078: channel forced to chat) ─
  const admin = createAdminClient();

  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: `tariff-supplement-${auth.workspaceId}`,
    channel: "chat" as const,
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Invoke capability tool ────────────────────────────────────────────────
  // Phase 7g: supplement_type and rate_type now use DB taxonomy in both
  // contract and tool schema — body values passed directly, no translation.
  let toolResult: string;
  try {
    toolResult = await addSupplementOverrideTool.execute(
      {
        workspace_id: auth.workspaceId,
        name: body.name,
        supplement_type: body.supplement_type,
        rate_value: body.rate_value,
        rate_type: body.rate_type,
        tariff_rate_table_id: body.tariff_rate_table_id ?? null,
        paragraf_ref: body.paragraf_ref ?? null,
        match_predicate: body.match_predicate as Record<string, unknown>,
        valid_from: null,
        valid_until: null,
      },
      ctx,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    const resp: AddSupplementResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: msg },
    };
    return NextResponse.json(resp, { status: 500 });
  }

  // ─── Parse tool JSON → BFF response ──────────────────────────────────────
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(toolResult) as Record<string, unknown>;
  } catch {
    const resp: AddSupplementResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Tool returned non-JSON" },
    };
    return NextResponse.json(resp, { status: 500 });
  }

  if (result.ok !== true) {
    const code = toErrorCode(typeof result.code === "string" ? result.code : "");
    const resp: AddSupplementResponse = {
      ok: false,
      error: {
        code,
        message: typeof result.message === "string" ? result.message : "Tool returned error",
        // ADR-0152: SUPPLEMENT_BELOW_TARIFF_FLOOR extension fields must pass through intact.
        ...(typeof result.aml_ref === "string" ? { aml_ref: result.aml_ref } : {}),
        ...(typeof result.floor === "number" ? { floor: result.floor } : {}),
        ...(typeof result.proposed === "number" ? { proposed: result.proposed } : {}),
      },
    };
    return NextResponse.json(resp, { status: toStatus(code) });
  }

  // ─── Build success response with audit block (ADR-0356) ──────────────────
  // Phase 7g: real emit IDs from tool (uuid-before-emit pattern).
  const resp: AddSupplementResponse = {
    ok: true,
    data: {
      supplement_rule_id: result.supplement_rule_id as string,
      name: body.name,
      rate_value: body.rate_value,
      rate_type: body.rate_type,
    },
    audit: {
      payroll_emit_id: result.payroll_emit_id as string,
      cascade_emit_id: result.cascade_emit_id as string,
      actor_capability: "payroll",
      delegated_via: "cascade",
    },
  };

  return NextResponse.json(resp, { status: 200 });
}
