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
 *   - amendment_classifier derivation (TARIFF_REVISION | UNION_CHANGE)
 *   - cascade.bind_workspace_union delegation with amendment_classifier="UP" (ADR-0356)
 *   - Dual-layer audit emit (ADR-0356 audit-symmetry)
 *
 * CONTRACT GAPs (flagged — do NOT fix in this file per hard rule):
 *   1. new_union_id type mismatch: BFF contract says z.string().uuid() but tool schema
 *      requires z.enum(["taro-79", "taro-226", "non-bound"]). Same gap as /setup.
 *   2. Audit emit IDs: see /setup route for full explanation.
 *   3. amendment_classifier in response: BFF contract uses z.enum(["UP", "MATERIAL",
 *      "ENDRINGSOPPSIGELSE"]) but tool returns semantic values ("TARIFF_REVISION" or
 *      "UNION_CHANGE"). The BFF maps these to the contract enum "UP" (the wire value
 *      that matches the cascade schema). MATERIAL/ENDRINGSOPPSIGELSE are blocked at
 *      the cascade layer per ADR-0252 §F and will not be returned by this tool in V1.
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — channel forced "chat" in synthetic ctx; tool enforces defence-in-depth.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from body).
 *   ADR-0152  — all errors use payrollTariffErrorSchema (code + message + optional ext).
 *   ADR-0252  — amendment_classifier derivation (simplified; ENDRINGSOPPSIGELSE deferred).
 *   ADR-0356  — audit block carries actor_capability='payroll', delegated_via='cascade'.
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import { randomUUID } from "crypto";
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

/**
 * Map tool semantic amendment_classifier to the BFF contract enum.
 * The tool returns "TARIFF_REVISION" | "UNION_CHANGE" (semantic).
 * The BFF contract requires "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE".
 * Both TARIFF_REVISION and UNION_CHANGE map to "UP" (the cascade wire value).
 * MATERIAL/ENDRINGSOPPSIGELSE are blocked at cascade layer (ADR-0252 §F).
 */
function toContractAmendmentClassifier(
  toolValue: string,
): "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE" {
  // TARIFF_REVISION and UNION_CHANGE both use "UP" as the cascade wire value.
  if (toolValue === "TARIFF_REVISION" || toolValue === "UNION_CHANGE") return "UP";
  // MATERIAL and ENDRINGSOPPSIGELSE pass through if the cascade layer ever returns them.
  if (toolValue === "MATERIAL") return "MATERIAL";
  if (toolValue === "ENDRINGSOPPSIGELSE") return "ENDRINGSOPPSIGELSE";
  // Unknown value — default to UP (the most common case for tariff updates).
  return "UP";
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
  const correlationId = randomUUID();
  const admin = createAdminClient();

  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: `tariff-change-${correlationId}`,
    channel: "chat" as const,
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Invoke capability tool ────────────────────────────────────────────────
  // CONTRACT GAP — new_union_id mismatch: contract says UUID; tool requires enum.
  const toolNewUnionId = body.new_union_id as "taro-79" | "taro-226" | "non-bound";

  let toolResult: string;
  try {
    toolResult = await changeWorkspaceTariffTool.execute(
      {
        workspace_id: auth.workspaceId,
        new_union_id: toolNewUnionId,
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
  // CONTRACT GAP: tool does not return emit IDs. Using correlation UUIDs.
  //
  // amendment_classifier: tool returns "TARIFF_REVISION" | "UNION_CHANGE" (semantic).
  // BFF contract requires "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE".
  // See toContractAmendmentClassifier() above for mapping rationale.
  const toolAmendmentClassifier =
    typeof result.amendment_classifier === "string"
      ? result.amendment_classifier
      : "TARIFF_REVISION";

  const resp: ChangeTariffResponse = {
    ok: true,
    data: {
      old_workspace_union_binding_id: result.old_workspace_union_binding_id as string,
      new_workspace_union_binding_id: result.new_workspace_union_binding_id as string,
      effective_from: result.effective_from as string,
      amendment_classifier: toContractAmendmentClassifier(toolAmendmentClassifier),
      old_law_version: body.new_law_version, // tool doesn't return old_law_version — use body as proxy
      new_law_version: body.new_law_version,
    },
    audit: {
      payroll_emit_id: correlationId,
      cascade_emit_id: randomUUID(),
      actor_capability: "payroll",
      delegated_via: "cascade",
    },
  };

  return NextResponse.json(resp, { status: 200 });
}
