// GET /api/contracts — list employee contracts for a workspace (paginated)
// POST /api/contracts — create a new employee contract draft via contract-service
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { z } from "zod";

const createSchema = z.object({
  template_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  overrides: z.record(z.string()).optional(),
});

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// GET /api/contracts
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspace_id");
  if (!workspaceId) return NextResponse.json({ error: "workspace_id required" }, { status: 400 });

  const status = request.nextUrl.searchParams.get("status");
  const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);

  let query = supabase
    .from("contract")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId)
    .eq("contract_type", "employee")
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, total: count, page, pageSize: PAGE_SIZE });
}

// ---------------------------------------------------------------------------
// POST /api/contracts
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { template_id, profile_id, workspace_id, overrides } = parsed.data;

  // Build the placeholder map using the user's JWT so RLS applies correctly.
  const placeholderMap = await buildEmployeePlaceholderMap(supabase, profile_id, workspace_id);
  const resolvedValues = { ...placeholderMap, ...overrides };

  // Fetch recipient email from user_identity via profile.
  // Supabase FK joins may return as array — normalise with Array.isArray.
  const { data: profileData } = await supabase
    .from("profile")
    .select("display_name, user_identity:user_id(email)")
    .eq("profile_id", profile_id)
    .single();

  const userIdentityRaw = profileData?.user_identity;
  const userIdentity = (Array.isArray(userIdentityRaw) ? userIdentityRaw[0] : userIdentityRaw) as
    | { email: string }
    | null
    | undefined;

  const recipientEmail = userIdentity?.email ?? "";
  const recipientName = profileData?.display_name ?? "";

  if (!recipientEmail) {
    return NextResponse.json({ error: "Employee has no email address" }, { status: 400 });
  }

  // Call the contract microservice to create a draft.
  const serviceUrl = process.env.CONTRACT_SERVICE_URL;
  const serviceKey = process.env.CONTRACT_SERVICE_KEY;

  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Contract service not configured" }, { status: 503 });
  }

  const serviceResponse = await fetch(`${serviceUrl}/contracts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": serviceKey,
    },
    body: JSON.stringify({
      template_id,
      workspace_id,
      contract_type: "employee",
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      resolved_values: resolvedValues,
    }),
  });

  if (!serviceResponse.ok) {
    const err = await serviceResponse.json().catch(() => ({ error: "Service error" }));
    return NextResponse.json(err, { status: serviceResponse.status });
  }

  const contract = (await serviceResponse.json()) as { contract_id: string };

  // Link the new contract to the employee's most recent employment_contract row.
  // Uses admin client to bypass RLS — this is a cross-table system operation, not user-initiated data access.
  // signing_contract_id was added in migration 20260428210000 — cast needed until types are regenerated.
  const admin = createAdminClient();
  await admin
    .from("employment_contract")
    .update({ signing_contract_id: contract.contract_id } as Record<string, unknown>)
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })
    .limit(1);

  return NextResponse.json(contract, { status: 201 });
}
