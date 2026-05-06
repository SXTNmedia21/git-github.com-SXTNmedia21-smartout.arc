/**
 * GET /api/employment-contracts/list — List employment contracts for a workspace.
 *
 * Decision 1A: employment_contract is the primary source, LEFT JOINed to contract
 * via signing_contract_id so DocuSeal fields (sent_at, signed_at, signing_url,
 * recipient_email) are surfaced when a signing document exists.
 *
 * Decision 2C: employment_contract.contract_id is the canonical row ID carried as
 * contract_id in the response. signing_contract_id is an attribute (null until a
 * signing document is created). The cancel route expects the contract table ID, so
 * callers use signing.contract_id for cancel, employment_contract.contract_id for delete.
 *
 * ADR-0151: workspace_id from query param validated against JWT via RLS — never
 * accepted from body.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import type { Database } from "@smartout/supabase/database.types";

type ContractStatus = Database["public"]["Enums"]["contract_status"];

const VALID_STATUSES: readonly ContractStatus[] = [
  "draft",
  "ready_to_send",
  "sent",
  "viewed",
  "pending_signature",
  "signed",
  "active",
  "expired",
  "declined",
  "terminated",
  "superseded",
  "pending_data",
  "migration_incomplete",
] as const;

const PAGE_SIZE = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const workspaceId = request.nextUrl.searchParams.get("workspace_id");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));

  // LEFT JOIN contract via signing_contract_id FK.
  // PostgREST returns null for the embedded object when signing_contract_id is null,
  // which is semantically equivalent to a LEFT JOIN — no employment_contract rows
  // are dropped.
  let query = supabase
    .from("employment_contract")
    .select(
      [
        "contract_id",
        "profile_id",
        "status",
        "position_title",
        "employment_category",
        "employment_percentage",
        "hourly_rate",
        "monthly_salary",
        "created_at",
        "signed_at",
        "signing_contract_id",
        "profile:profile_id(display_name)",
        // Embedded contract row (null when signing_contract_id is null).
        // Aliased as "signing" to distinguish from employment_contract fields.
        "signing:signing_contract_id(contract_id, sent_at, signed_at, signing_url, recipient_email, status)",
      ].join(", "),
      { count: "exact" },
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status as ContractStatus);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}
