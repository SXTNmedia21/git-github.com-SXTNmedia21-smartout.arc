import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";

// ---------------------------------------------------------------------------
// GET /api/onboarding/clauses?industryCode=56.10
//
// Returns active contract clauses from clause_library, filtered by industry.
// - If industryCode is provided: universal clauses (empty industry_codes)
//   PLUS clauses matching the given NACE code.
// - If no industryCode: only universal clauses.
//
// No auth required — clause content is public preview data used during
// the onboarding flow before a workspace exists.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const industryCode = request.nextUrl.searchParams.get("industryCode");

  const supabase = createAdminClient();

  let query = supabase
    .from("clause_library")
    .select("id, title, category, content_html")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (industryCode) {
    // Universal clauses (empty array) + industry-specific matches
    query = query.or(`industry_codes.eq.{},industry_codes.cs.{${industryCode}}`);
  } else {
    // Only universal clauses
    query = query.eq("industry_codes", [] as string[]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[clauses] Failed to fetch clauses:", error.message);
    return NextResponse.json({ error: "Failed to fetch clauses" }, { status: 500 });
  }

  // Map id → clause_id for the consumer contract (clause_library PK is "id")
  const clauses = (data ?? []).map((row) => ({
    clause_id: row.id,
    title: row.title,
    category: row.category,
    content_html: row.content_html,
  }));

  return NextResponse.json(clauses);
}
