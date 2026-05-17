/**
 * POST /api/payroll/tariff/change
 *
 * BFF route — switch tariff binding when new law_version lands or union changes.
 * Wraps payroll.change_workspace_tariff capability tool (tariff-tools.ts).
 *
 * This route is HTTP-shaped glue only. All business logic lives in
 * changeWorkspaceTariffTool.execute(), which encodes:
 *   - L-0177 fail-fast (workspaceId + profileId non-empty from ctx)
 *   - Chat-channel guard (ADR-0078 Høy-PII)
 *   - Cross-workspace block (ADR-0151)
 *   - gatedMutation payroll authority gate (ADR-0204 + ADR-0287)
 *   - NO_EXISTING_BINDING guard
 *   - amendment_classifier derivation (Lovsen rule matrix, legal.classifyAmendmentLogic)
 *   - cascade.bind_workspace_union delegation (ADR-0356)
 *   - Dual-layer audit emit (ADR-0356 audit-symmetry)
 *
 * Phase 7g reconciliation: CONTRACT GAPS closed.
 *   new_union_id: contract now z.enum([...]) — no UUID→enum translation needed.
 *   audit block: real payroll_emit_id + cascade_emit_id from tool (uuid-before-emit).
 *   old_law_version: now read from DB by tool, passed through directly.
 *   amendment_classifier: tool returns UP/MATERIAL/ENDRINGSOPPSIGELSE directly
 *     (Lovsen classifier). toContractAmendmentClassifier() mapping removed.
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — channel forced "chat" in synthetic ctx; tool enforces defence-in-depth.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from body).
 *   ADR-0152  — all errors use payrollTariffErrorSchema (code + message + optional ext).
 *   ADR-0252  — amendment_classifier derivation (Lovsen rule matrix per §14-6 + §15-7).
 *   ADR-0356  — audit block carries actor_capability='payroll', delegated_via='cascade'.
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { changeWorkspaceTariffTool } from "@smartout/ai/capabilities/payroll/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";
import {
  changeTariffRequestSchema,
  payrollTariffErrorCodeSchema,
  type PayrollTariffErrorCode,
  type ChangeTariffResponse,
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
    case "NO_EXISTING_BINDING":
      return 409;
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
    const resp: ChangeTariffResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Body must be valid JSON" },
    };
    return NextResponse.json(resp, { status: 400 });
  }

  const parsed = changeTariffRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const resp: ChangeTariffResponse = {
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
    const resp: ChangeTariffResponse = {
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
    sessionId: `tariff-change-${auth.workspaceId}`,
    channel: "chat" as const,
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Invoke capability tool ────────────────────────────────────────────────
  // Phase 7g: new_union_id is now z.enum([...]) in both contract and tool schema.
  // body.new_union_id is already typed as UnionId — no cast required.
  let toolResult: string;
  try {
    toolResult = await changeWorkspaceTariffTool.execute(
      {
        workspace_id: auth.workspaceId,
        new_union_id: body.new_union_id,
        new_law_version: body.new_law_version,
        official_effective_date: body.official_effective_date,
        effective_from: body.effective_from,
        derivation_snapshot_id: null,
        reason: body.reason,
      },
      ctx,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    const resp: ChangeTariffResponse = {
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
    const resp: ChangeTariffResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Tool returned non-JSON" },
    };
    return NextResponse.json(resp, { status: 500 });
  }

  if (result.ok !== true) {
    const code = toErrorCode(typeof result.code === "string" ? result.code : "");
    const resp: ChangeTariffResponse = {
      ok: false,
      error: {
        code,
        message: typeof result.message === "string" ? result.message : "Tool returned error",
        ...(typeof result.aml_ref === "string" ? { aml_ref: result.aml_ref } : {}),
        ...(typeof result.floor === "number" ? { floor: result.floor } : {}),
        ...(typeof result.proposed === "number" ? { proposed: result.proposed } : {}),
      },
    };
    return NextResponse.json(resp, { status: toStatus(code) });
  }

  // ─── Build success response with audit block (ADR-0356) ──────────────────
  // Phase 7g: real emit IDs from tool + old_law_version read from DB by tool.
  // amendment_classifier: tool returns UP/MATERIAL/ENDRINGSOPPSIGELSE directly
  // (Lovsen classifier — no translation needed).
  const resp: ChangeTariffResponse = {
    ok: true,
    data: {
      old_workspace_union_binding_id: result.old_workspace_union_binding_id as string,
      new_workspace_union_binding_id: result.new_workspace_union_binding_id as string,
      effective_from: result.effective_from as string,
      amendment_classifier: result.amendment_classifier as "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE",
      old_law_version: result.old_law_version as string,
      new_law_version: body.new_law_version,
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
