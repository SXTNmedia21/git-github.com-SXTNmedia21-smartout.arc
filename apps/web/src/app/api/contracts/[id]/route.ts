// GET /api/contracts/[id] — fetch a single employee contract with its event history
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch contract and its event log in parallel
  const [contractResult, eventsResult] = await Promise.all([
    supabase.from("contract").select("*").eq("contract_id", id).single(),
    supabase.from("contract_event").select("*").eq("contract_id", id).order("created_at"),
  ]);

  if (contractResult.error) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...contractResult.data,
    events: eventsResult.data ?? [],
  });
}
