import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const SendContractSchema = z.object({
  templateId: z.string().uuid(),
  workspaceId: z.string().uuid().optional(),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email(),
  businessData: z.object({
    name: z.string().min(1),
    legalName: z.string().optional(),
    orgNumber: z.string().min(1),
    address: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    industry: z.string().optional(),
    industryCode: z.string().optional(),
    departments: z.array(z.string()).optional(),
  }),
});

// Placeholder workspace ID used when the workspace has not been created yet
const PLACEHOLDER_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// POST /api/onboarding/send-contract
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse & validate request body
  let body: z.infer<typeof SendContractSchema>;
  try {
    const raw = await request.json();
    body = SendContractSchema.parse(raw);
  } catch (err) {
    const message =
      err instanceof z.ZodError
        ? err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")
        : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // 3. Check contract service availability
  if (!isContractServiceConfigured()) {
    return NextResponse.json({ error: "Contract service is not configured" }, { status: 503 });
  }

  try {
    const { templateId, workspaceId, recipientName, recipientEmail, businessData } = body;

    // 4. Build value_overrides mapping business data to contract template placeholder keys.
    //    Keys must match data-key attributes in the contract_template content_html.
    const valueOverrides: Record<string, string> = {
      kunde_firma: businessData.legalName || businessData.name,
      kunde_org_nr: businessData.orgNumber,
      kunde_daglig_leder: recipientName,
      kunde_epost: recipientEmail,
      kunde_faktura_epost: recipientEmail,
    };

    if (businessData.address) {
      valueOverrides.kunde_adresse = businessData.address;
    }
    if (businessData.postalCode || businessData.city) {
      valueOverrides.kunde_postnr_sted = [businessData.postalCode, businessData.city]
        .filter(Boolean)
        .join(", ");
    }
    if (businessData.phone) {
      valueOverrides.kunde_tlf = businessData.phone;
    }

    // 5. Create contract via contract-service
    const createRes = await callContractService("/contracts", {
      method: "POST",
      body: JSON.stringify({
        template_id: templateId,
        workspace_id: workspaceId ?? PLACEHOLDER_WORKSPACE_ID,
        contract_type: "client",
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        journey_type: "self_service",
        value_overrides: valueOverrides,
        metadata: {
          source: "onboarding",
          user_id: user.id,
          ...(businessData.industryCode ? { industry_code: businessData.industryCode } : {}),
        },
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes
        .json()
        .catch(() => ({ message: "Unknown contract service error" }));
      console.error("[send-contract] Contract creation failed:", createRes.status, errData);
      return NextResponse.json(
        { error: errData.message ?? "Failed to create contract" },
        { status: 502 },
      );
    }

    const contract = (await createRes.json()) as {
      contract_id: string;
      signing_url?: string;
    };

    // 6. Send the contract immediately
    const sendRes = await callContractService(`/contracts/${contract.contract_id}/send`, {
      method: "POST",
      headers: { "X-User-Id": user.id },
    });

    if (!sendRes.ok) {
      const errData = await sendRes.json().catch(() => ({ message: "Unknown send error" }));
      console.error("[send-contract] Contract send failed:", sendRes.status, errData);
      return NextResponse.json(
        { error: errData.message ?? "Failed to send contract" },
        { status: 502 },
      );
    }

    const sendData = (await sendRes.json()) as {
      signing_url?: string;
    };

    // 7. Return success
    return NextResponse.json({
      contractId: contract.contract_id,
      signingUrl: sendData.signing_url ?? contract.signing_url ?? null,
      status: "sent",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-contract] Failed:", message);
    return NextResponse.json({ error: "Failed to send contract" }, { status: 500 });
  }
}
