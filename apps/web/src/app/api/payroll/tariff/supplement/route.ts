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
 * CONTRACT GAPs (flagged — do NOT fix in this file per hard rule):
 *   1. supplement_type taxonomy mismatch:
 *      BFF contract uses semantic UX labels: "evening" | "night" | "weekend" | "holiday"
 *        | "overtime" | "split_shift" | "callout" | "shoe_allowance" | ...
 *      Tool/DB schema uses internal classification: "normal" | "week_based" | "day_based"
 *        | "manual" | "holiday" | "contract_rule"
 *      These are different classification systems. The BFF maps contract → tool using
 *      SUPPLEMENT_TYPE_MAP below. "holiday" maps 1:1; all others map to "normal"
 *      (time-based additive supplement) or "manual" (discretionary). This mapping
 *      will lose nuance until Phase 7g aligns the contract with the DB taxonomy.
 *   2. rate_type mismatch:
 *      BFF contract: "percentage" | "fixed_amount" | "hourly_rate"
 *      Tool schema:  "fixed_per_hour" | "percentage" | "fixed_per_shift"
 *      Mapped: "fixed_amount" → "fixed_per_hour", "hourly_rate" → "fixed_per_hour",
 *              "percentage" → "percentage". "fixed_per_shift" unavailable from contract.
 *   3. Audit emit IDs: see /setup route for full explanation.
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — channel forced "chat" in synthetic ctx; tool enforces defence-in-depth.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from body).
 *   ADR-0152  — all errors use payrollTariffErrorSchema; SUPPLEMENT_BELOW_TARIFF_FLOOR
 *               passes through with aml_ref + floor + proposed (ADR-0152 ext fields).
 *   ADR-0356  — audit block carries actor_capability='payroll', delegated_via='cascade'.
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import { randomUUID } from "crypto";
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

/**
 * Map BFF contract supplement_type → tool DB supplement_type.
 * CONTRACT GAP — see file-level docstring for full explanation.
 */
function toToolSupplementType(
  contractType: string,
): "normal" | "week_based" | "day_based" | "manual" | "holiday" | "contract_rule" {
  switch (contractType) {
    case "holiday":
      return "holiday";
    case "evening":
    case "night":
    case "weekend":
    case "overtime":
    case "split_shift":
    case "callout":
      // Time-based or shift-based supplements → "normal" (per-shift additive rule).
      return "normal";
    case "shoe_allowance":
    case "uniform_allowance":
    case "transport_allowance":
    case "meal_allowance":
    case "language_allowance":
    case "responsibility_allowance":
    case "other":
      // Discretionary / allowance types → "manual".
      return "manual";
    default:
      return "manual";
  }
}

/**
 * Map BFF contract rate_type → tool DB rate_type.
 * CONTRACT GAP — see file-level docstring for full explanation.
 */
function toToolRateType(
  contractRateType: string,
): "fixed_per_hour" | "percentage" | "fixed_per_shift" {
  switch (contractRateType) {
    case "percentage":
      return "percentage";
    case "fixed_amount":
    case "hourly_rate":
      // Both map to fixed_per_hour (the tool's closest equivalent).
      return "fixed_per_hour";
    default:
      return "fixed_per_hour";
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
  const correlationId = randomUUID();
  const admin = createAdminClient();

  const ctx: AgentToolContext = {
    workspaceId: auth.workspaceId as NonEmptyString,
    profileId: auth.profileId as NonEmptyString,
    userId: auth.userId,
    sessionId: `tariff-supplement-${correlationId}`,
    channel: "chat" as const,
    supabaseAdmin: admin as unknown as SupabaseClient,
  };

  // ─── Invoke capability tool ────────────────────────────────────────────────
  // Map contract types to tool types (CONTRACT GAP — see file-level docstring).
  const toolSupplementType = toToolSupplementType(body.supplement_type);
  const toolRateType = toToolRateType(body.rate_type);

  let toolResult: string;
  try {
    toolResult = await addSupplementOverrideTool.execute(
      {
        workspace_id: auth.workspaceId,
        name: body.name,
        supplement_type: toolSupplementType,
        rate_value: body.rate_value,
        rate_type: toolRateType,
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
  // CONTRACT GAP: tool does not return emit IDs. Using correlation UUIDs.
  const resp: AddSupplementResponse = {
    ok: true,
    data: {
      supplement_rule_id: result.supplement_rule_id as string,
      name: body.name,
      rate_value: body.rate_value,
      rate_type: body.rate_type,
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
