// GET /api/contracts — list employee contracts for a workspace (paginated)
// POST /api/contracts — create a new employee contract draft via contract-service
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { emit } from "@smartout/telemetry";
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

  // Verify caller has admin or owner role in this workspace — employees must not create contracts.
  // Uses the user-scoped client so RLS applies (no bypass via service role).
  const { data: callerProfile } = await supabase
    .from("profile")
    .select("role")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "owner")) {
    return NextResponse.json(
      { error: "Forbidden: only admins and owners can create contracts" },
      { status: 403 },
    );
  }

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

  // Fetch template to resolve HTML with placeholder values.
  const admin = createAdminClient();
  const { data: template, error: tplErr } = await admin
    .from("contract_template")
    .select("name, content_html, placeholders")
    .eq("template_id", template_id)
    .single();

  if (tplErr || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Simple placeholder resolution: replace {{key}} with resolved values.
  let resolvedHtml = template.content_html ?? "";
  for (const [key, value] of Object.entries(resolvedValues)) {
    resolvedHtml = resolvedHtml.replaceAll(`{{${key}}}`, String(value ?? ""));
  }

  // Generate contract number (sequence-based if RPC exists, fallback to timestamp).
  let contractNumber = `KONTRAKT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
  const { data: numResult } = await admin.rpc("generate_contract_number" as never);
  if (numResult) contractNumber = numResult as string;

  // Fetch company_id for the workspace.
  const { data: ws } = await admin
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", workspace_id)
    .single();

  // Write contract draft directly to Supabase — no microservice needed for draft creation.
  // The contract-service is only required for DocuSeal signing dispatch.
  const { data: contract, error: insertErr } = await admin
    .from("contract")
    .insert({
      company_id: ws?.company_id ?? null,
      workspace_id,
      template_id,
      contract_type: "employee",
      contract_number: contractNumber,
      title: `${template.name} - ${recipientName}`,
      resolved_html: resolvedHtml,
      resolved_values: resolvedValues,
      sender_name: "Smartout",
      sender_email: "no-reply@smartout.ai",
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      status: "draft",
    })
    .select("contract_id")
    .single();

  if (insertErr || !contract) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to create contract" },
      { status: 500 },
    );
  }

  // Log creation event.
  await admin.from("contract_event").insert({
    contract_id: contract.contract_id,
    workspace_id,
    event_type: "created",
    actor_type: "user",
    actor_id: user.id,
  });

  // Link to the employee's most recent employment_contract row.
  await admin
    .from("employment_contract")
    .update({ signing_contract_id: contract.contract_id } as Record<string, unknown>)
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .order("created_at", { ascending: false })
    .limit(1);

  void emit({
    event: "contract created",
    workspace_id,
    actor_id: user.id,
    properties: {
      entity: { entity_type: "contract" as const, entity_id: contract.contract_id },
      data: { template_id, recipient_email: recipientEmail, contract_type: "employee" },
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
