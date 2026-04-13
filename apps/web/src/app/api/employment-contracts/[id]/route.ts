/**
 * GET /api/employment-contracts/[id] — Fetch a single employment contract.
 *
 * Returns contract details including the employee's display name (via profile join),
 * framework snapshot, compliance overrides, and decline info.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("employment_contract")
    .select(
      `
      contract_id,
      profile_id,
      status,
      position_title,
      hourly_rate,
      monthly_salary,
      employment_percentage,
      start_date,
      framework_snapshot,
      compliance_overrides,
      parent_contract_id,
      decline_reason_code,
      decline_reason_text,
      profile:profile_id(display_name)
    `,
    )
    .eq("contract_id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
