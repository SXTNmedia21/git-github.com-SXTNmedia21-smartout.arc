/**
 * GET /api/payroll/tariff/current
 *
 * BFF read route — active tariff binding + supplement paragraf_references.
 * No capability tool invoked. Direct Supabase read (admin client, workspace-scoped).
 *
 * Read path:
 *   1. Resolve identity server-side (ADR-0151, L-0177).
 *   2. Query workspace_union_binding for the active binding (effective_to IS NULL).
 *   3. Resolve union_name from the static UNION_DISPLAY_NAMES map (no FK to regulatory_framework).
 *   4. Query supplement_rule for paragraf_ref values in this workspace.
 *   5. Enrich paragraf_refs via lovsen-client.ts static Riksavtalen map.
 *   6. Return CurrentTariffResponse.
 *
 * Why direct read (not capability tool)?
 *   No mutation occurs. No authority gate is required for reads at the read_only authority
 *   level. Admin client + explicit workspace_id filter enforces workspace isolation.
 *   Established pattern: see /api/payroll/lock-period read path.
 *
 * Why static union_name map?
 *   workspace_union_binding.union_id is a TEXT field ("taro-79" | "taro-226" | "non-bound").
 *   It has NO FK to regulatory_framework (no union_id column on that table). Display names
 *   are stable per union agreement — a static map is the correct approach until a union
 *   master table is added (Phase 7g).
 *
 * ADR compliance (body verified before docstring — L-0176):
 *   ADR-0078  — read path; no mutation; channel not enforced on reads.
 *   ADR-0151  — workspace_id derived server-side via resolvePayrollAuth (never from query).
 *   ADR-0152  — errors use payrollTariffErrorSchema (code + message).
 *   ADR-0355  — queries active binding via effective_to IS NULL (APPEND-ONLY semantics).
 *   L-0177    — resolvePayrollAuth returns null on missing/empty IDs → 401.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { rejectCrossOrigin, resolvePayrollAuth } from "@/app/api/payroll/_shared";
import { createAdminClient } from "@smartout/supabase/admin";
import { enrichParagrafRefs } from "@/lib/tariff/lovsen-client";
import {
  payrollTariffErrorCodeSchema,
  type PayrollTariffErrorCode,
  type CurrentTariffResponse,
} from "@smartout/types";

export const runtime = "nodejs";

function toErrorCode(raw: string): PayrollTariffErrorCode {
  const parsed = payrollTariffErrorCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "BFF_INTERNAL_ERROR";
}

/**
 * Static display names for union_id values.
 * workspace_union_binding.union_id is a TEXT column — no FK to a union master table.
 * Kept in sync with the tool enum in tariff-tools.ts setupWorkspaceTariffSchema.union_id.
 */
const UNION_DISPLAY_NAMES: Record<string, string> = {
  "taro-79": "Riksavtalen (NHO Reiseliv / Fellesforbundet)",
  "taro-226": "Parat overenskomst (NHO Reiseliv / Parat)",
  "non-bound": "Ikke tariffbundet",
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ─── CORS guard ───────────────────────────────────────────────────────────
  const cors = rejectCrossOrigin(request);
  if (cors) return cors;

  // ─── Identity (ADR-0151: server-derived, never from query params) ────────
  // L-0177: null → 401 UNAUTHORIZED.
  const auth = await resolvePayrollAuth(request);
  if (!auth) {
    const resp: CurrentTariffResponse = {
      ok: false,
      error: {
        code: toErrorCode("UNAUTHORIZED"),
        message: "Authentication required (L-0177)",
      },
    };
    return NextResponse.json(resp, { status: 401 });
  }

  const admin = createAdminClient();

  // ─── Query active binding (effective_to IS NULL = currently active) ───────
  // ADR-0355 APPEND-ONLY: the active binding always has effective_to IS NULL.
  // If multiple rows have effective_to IS NULL (should not happen per DB constraints),
  // order by effective_from DESC and take the most recent.
  const { data: bindingRows, error: bindingErr } = await admin
    .from("workspace_union_binding")
    .select("workspace_union_binding_id, union_id, law_version, effective_from")
    .eq("workspace_id", auth.workspaceId)
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1);

  if (bindingErr) {
    const resp: CurrentTariffResponse = {
      ok: false,
      error: {
        code: toErrorCode("INVALID_WORKSPACE"),
        message: `Failed to query active binding: ${bindingErr.message}`,
      },
    };
    return NextResponse.json(resp, { status: 500 });
  }

  const binding = bindingRows?.[0] ?? null;

  // ─── Query supplement_rule paragraf_refs for this workspace ──────────────
  // paragraf_ref is a nullable text column on supplement_rule.
  // Collect distinct non-null refs for enrichment.
  const { data: supplementRows } = await admin
    .from("supplement_rule")
    .select("paragraf_ref")
    .eq("workspace_id", auth.workspaceId)
    .not("paragraf_ref", "is", null);

  const rawParagrafRefs = (supplementRows ?? []).map((row) => row.paragraf_ref as string | null);

  // ─── Enrich paragraf_refs via lovsen-client static Riksavtalen map ────────
  const paragrafEntries = enrichParagrafRefs(rawParagrafRefs, binding?.law_version ?? null);

  // ─── Build response ───────────────────────────────────────────────────────
  if (!binding) {
    // No active binding — workspace is not yet tariff-bound (valid state).
    const resp: CurrentTariffResponse = {
      ok: true,
      data: {
        workspace_union_binding_id: null,
        union_id: null,
        union_name: null,
        law_version: null,
        effective_from: null,
        is_bound: false,
        paragraf_references: paragrafEntries,
      },
    };
    return NextResponse.json(resp, { status: 200 });
  }

  const unionId = binding.union_id as string;
  const unionName = UNION_DISPLAY_NAMES[unionId] ?? unionId;

  const resp: CurrentTariffResponse = {
    ok: true,
    data: {
      workspace_union_binding_id: binding.workspace_union_binding_id as string,
      union_id: unionId,
      union_name: unionName,
      law_version: binding.law_version as string,
      effective_from: binding.effective_from as string,
      is_bound: unionId !== "non-bound",
      paragraf_references: paragrafEntries,
    },
  };

  return NextResponse.json(resp, { status: 200 });
}
