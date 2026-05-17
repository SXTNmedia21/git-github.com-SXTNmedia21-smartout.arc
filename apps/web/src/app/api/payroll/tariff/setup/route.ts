/**
 * POST /api/payroll/tariff/setup
 *
 * BFF route — first-time tariff binding for a workspace.
 * Wraps payroll.setup_workspace_tariff capability tool (tariff-tools.ts).
 *
 * This route is HTTP-shaped glue only. All business logic lives in
 * setupWorkspaceTariffTool.execute(), which encodes:
 *   - L-0177 fail-fast (workspaceId + profileId non-empty from ctx)
 *   - Chat-channel guard (ADR-0078 Høy-PII)
 *   - Cross-workspace block (ADR-0151)
 *   - gatedMutation payroll authority gate (ADR-0204 + ADR-0287)
 *   - TARIFF_ALREADY_BOUND guard
 *   - cascade.bind_workspace_union delegation (ADR-0356)
 *   - Dual-layer audit emit (ADR-0356 audit-symmetry)
 *
 * Phase 7g reconciliation: CONTRACT GAPS closed.
 *   union_id: contract now z.enum([...]) — no UUID→enum translation needed.
 *   audit block: real payroll_emit_id + cascade_emit_id from tool (uuid-before-emit).
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — channel forced "chat" in synthetic ctx; tool enforces defence-in-depth.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from body).
 *   ADR-0152  — all errors use payrollTariffErrorSchema (code + message + optional ext).
 *   ADR-0356  — audit block carries actor_capability='payroll', delegated_via='cascade'.
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { setupWorkspaceTariffTool } from "@smartout/ai/capabilities/payroll/tools";
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import type { NonEmptyString } from "@smartout/telemetry/server";
import {
  setupTariffRequestSchema,
  payrollTariffErrorCodeSchema,
  type PayrollTariffErrorCode,
  type SetupTariffResponse,
} from "@smartout/types";

export const runtime = "nodejs";

/** Map raw tool error code to a validated PayrollTariffErrorCode (ADR-0152). */
function toErrorCode(raw: string): PayrollTariffErrorCode {
  const parsed = payrollTariffErrorCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "BFF_INTERNAL_ERROR";
}

/** Map PayrollTariffErrorCode to an HTTP status code. */
function toStatus(code: PayrollTariffErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
    case "MISSING_PROFILE_CONTEXT":
      return 401;
    case "TARIFF_ALREADY_BOUND":
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
    const resp: SetupTariffResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Body must be valid JSON" },
    };
    return NextResponse.json(resp, { status: 400 });
  }

  const parsed = setupTariffRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    const resp: SetupTariffResponse = {
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
    const resp: SetupTariffResponse = {
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
    sessionId: `tariff-setup-${auth.workspaceId}`,
    channel: "chat" as const,
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Invoke capability tool ────────────────────────────────────────────────
  // Phase 7g: union_id is now z.enum([...]) in both contract and tool schema.
  // body.union_id is already typed as UnionId — no cast required.
  let toolResult: string;
  try {
    toolResult = await setupWorkspaceTariffTool.execute(
      {
        workspace_id: auth.workspaceId,
        union_id: body.union_id,
        law_version: body.law_version,
        official_effective_date: body.official_effective_date,
        effective_from: body.effective_from,
        derivation_snapshot_id: null,
      },
      ctx,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    const resp: SetupTariffResponse = {
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
    const resp: SetupTariffResponse = {
      ok: false,
      error: { code: "BFF_INTERNAL_ERROR", message: "Tool returned non-JSON" },
    };
    return NextResponse.json(resp, { status: 500 });
  }

  if (result.ok !== true) {
    const code = toErrorCode(typeof result.code === "string" ? result.code : "");
    const resp: SetupTariffResponse = {
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
  // Phase 7g: real emit IDs returned from tool (uuid-before-emit pattern).
  const resp: SetupTariffResponse = {
    ok: true,
    data: {
      workspace_union_binding_id: result.workspace_union_binding_id as string,
      effective_from: result.effective_from as string,
      union_id: body.union_id,
      law_version: body.law_version,
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
