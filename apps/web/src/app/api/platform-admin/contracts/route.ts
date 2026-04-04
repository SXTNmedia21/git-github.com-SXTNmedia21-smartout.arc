import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { getSuperAdminId, logPlatformAction } from "@/lib/platform-admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit } from "@smartout/telemetry";

const CreateContractSchema = z.object({
  template_id: z.string().uuid(),
  company_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional(),
  recipient_name: z.string().min(1),
  recipient_email: z.string().email(),
  title: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const type = request.nextUrl.searchParams.get("type");

  if (type === "templates") {
    const { data, error } = await admin
      .from("contract_template")
      .select("template_id, name, contract_type, description")
      .eq("is_active", true)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "companies") {
    const { data, error } = await admin.from("company").select("company_id, name").order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  if (type === "workspaces") {
    const companyId = request.nextUrl.searchParams.get("company_id");
    if (!companyId) {
      return NextResponse.json({ error: "company_id required" }, { status: 400 });
    }
    const { data, error } = await admin
      .from("workspace")
      .select("workspace_id, name, slug")
      .eq("company_id", companyId)
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = CreateContractSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten().fieldErrors }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve workspace_id: use provided value, or find the first workspace for the company
  let workspaceId = body.data.workspace_id;
  if (!workspaceId) {
    const { data: workspace } = await admin
      .from("workspace")
      .select("workspace_id")
      .eq("company_id", body.data.company_id)
      .limit(1)
      .single();
    workspaceId = workspace?.workspace_id ?? undefined;
  }

  // Fetch the template
  const { data: template, error: templateError } = await admin
    .from("contract_template")
    .select("template_id, name, contract_type, content_html, placeholders")
    .eq("template_id", body.data.template_id)
    .single();

  if (templateError || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  // Resolve placeholders from workspace/company data
  const placeholders =
    (template.placeholders as Array<{
      key: string;
      label: string;
      source: string;
      default_value?: string;
      required: boolean;
    }>) ?? [];

  let resolvedHtml = template.content_html ?? "";
  let resolvedValues: Record<string, string> = {};

  if (workspaceId && placeholders.length > 0) {
    const { data: wsData } = await admin
      .from("workspace")
      .select("*, company:company_id(*)")
      .eq("workspace_id", workspaceId)
      .single();

    const company = (wsData?.company ?? null) as Record<string, unknown> | null;

    const { buildAutofillMap, resolvePlaceholders } = await import("@smartout/utils");
    const autofillMap = buildAutofillMap(wsData, company, {
      companyName: process.env.PLATFORM_COMPANY_NAME ?? "",
      orgNumber: process.env.PLATFORM_ORG_NUMBER ?? "",
      contactEmail: process.env.PLATFORM_CONTACT_EMAIL ?? "",
      contactName: process.env.PLATFORM_CONTACT_NAME ?? "",
    });

    const result = resolvePlaceholders(resolvedHtml, placeholders, autofillMap, {
      recipient_name: body.data.recipient_name,
      recipient_email: body.data.recipient_email,
    });
    resolvedHtml = result.resolved_html;
    resolvedValues = result.resolved_values;
  }

  // Create the contract record as draft
  const contractTitle = body.data.title || `${template.name} - ${body.data.recipient_name}`;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: contract, error: createError } = await admin
    .from("contract")
    .insert({
      template_id: body.data.template_id,
      company_id: body.data.company_id,
      workspace_id: workspaceId ?? null,
      title: contractTitle,
      contract_type: template.contract_type,
      status: "draft",
      recipient_name: body.data.recipient_name,
      recipient_email: body.data.recipient_email,
      resolved_html: resolvedHtml,
      resolved_values: resolvedValues as unknown as Json,
      expires_at: expiresAt,
      metadata: (body.data.notes ? { internal_notes: body.data.notes } : {}) as unknown as Json,
      created_by: adminId,
      created_at: now,
      updated_at: now,
    })
    .select("contract_id")
    .single();

  if (createError || !contract) {
    return NextResponse.json(
      { error: createError?.message || "Failed to create contract" },
      { status: 500 },
    );
  }

  await logPlatformAction(adminId, "create_contract", "contract", contract.contract_id, {
    template_id: body.data.template_id,
    recipient_email: body.data.recipient_email,
  });

  void emit({
    event: "contract created",
    workspace_id: workspaceId ?? "",
    actor_id: adminId,
    properties: {
      entity: {
        entity_type: "contract",
        entity_id: contract.contract_id,
        entity_label: contractTitle,
      },
      data: {
        template_id: body.data.template_id,
        recipient_email: body.data.recipient_email,
        contract_type: template.contract_type,
      },
    },
  });

  // Try to send via contract microservice (if configured)
  let sendStatus: "draft" | "sent" = "draft";
  let sendWarning: string | undefined;

  if (isContractServiceConfigured()) {
    try {
      const sendRes = await callContractService(`/contracts/${contract.contract_id}/send`, {
        method: "POST",
        headers: { "X-User-Id": adminId },
      });

      if (sendRes.ok) {
        sendStatus = "sent";
        void emit({
          event: "contract sent",
          workspace_id: workspaceId ?? "",
          actor_id: adminId,
          properties: {
            entity: {
              entity_type: "contract",
              entity_id: contract.contract_id,
              entity_label: contractTitle,
            },
            data: { recipient_email: body.data.recipient_email, expires_at: expiresAt },
          },
        });
      } else {
        const sendBody = await sendRes.json();
        sendWarning = sendBody.error ?? "Failed to send via microservice";
      }
    } catch {
      sendWarning = "Contract microservice unreachable";
    }
  } else {
    sendWarning = "Contract microservice not configured — saved as draft";
  }

  return NextResponse.json(
    {
      data: { contract_id: contract.contract_id, status: sendStatus },
      ...(sendWarning ? { warning: sendWarning } : {}),
    },
    { status: 201 },
  );
}
