import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";
import { env } from "@/env";
import { emit, nonEmpty } from "@smartout/telemetry";

const DocuSealEventSchema = z.object({
  event_type: z.string(),
  timestamp: z.string(),
  data: z.object({
    id: z.number(),
    submission_id: z.number(),
    status: z.string(),
    documents: z
      .array(
        z.object({
          name: z.string(),
          url: z.string().url(),
        }),
      )
      .optional(),
    submitters: z
      .array(
        z.object({
          name: z.string().optional(),
          email: z.string().email(),
          role: z.string().optional(),
          completed_at: z.string().nullable().optional(),
        }),
      )
      .optional(),
    declined_at: z.string().nullable().optional(),
    decline_reason: z.string().nullable().optional(),
  }),
});

const eventToStatus: Record<string, string> = {
  "form.viewed": "viewed",
  "form.started": "viewed",
  "form.completed": "signed",
  "form.declined": "declined",
  "submission.completed": "signed",
  "submission.expired": "expired",
};

import type { Database } from "@smartout/supabase";

type ContractUpdate = Database["public"]["Tables"]["contract"]["Update"];

export async function POST(request: NextRequest) {
  // Validate webhook signature if configured
  const webhookSecret = env.DOCUSEAL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-docuseal-signature");
    if (signature !== webhookSecret) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const parsed = DocuSealEventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { event_type, data } = parsed.data;
  const newStatus = eventToStatus[event_type];

  if (!newStatus) {
    // Event type not relevant — acknowledge silently
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  // Find contract by DocuSeal submission ID
  const { data: contract, error: findError } = await admin
    .from("contract")
    .select("contract_id, status, workspace_id, contract_type")
    .eq("docuseal_submission_id", String(data.submission_id))
    .single();

  if (findError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Prevent status regression from out-of-order webhook events
  const statusWeight: Record<string, number> = {
    draft: 0,
    sent: 1,
    viewed: 2,
    signed: 3,
    declined: 3,
    expired: 3,
    cancelled: 3,
  };
  const currentWeight = statusWeight[contract.status] ?? 0;
  const newWeight = statusWeight[newStatus] ?? 0;
  if (newWeight <= currentWeight) {
    return NextResponse.json({ received: true, skipped: "status_not_advanced" });
  }

  // Build update payload
  const updates: ContractUpdate = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };

  if (event_type === "form.viewed") {
    updates.viewed_at = new Date().toISOString();
  }

  if (newStatus === "signed") {
    updates.signed_at = new Date().toISOString();

    // Store document URL if provided
    if (data.documents && data.documents.length > 0) {
      updates.document_url = data.documents[0]!.url;
      updates.signed_pdf_url = data.documents[0]!.url;
    }

    // Update signatories with completion timestamps
    if (data.submitters?.length) {
      updates.signatories = data.submitters.map((s) => ({
        name: s.name || "",
        email: s.email,
        role: s.role || "signer",
        signed_at: s.completed_at || null,
      })) as unknown as Json;
    }
  }

  if (newStatus === "declined") {
    updates.declined_at = data.declined_at ?? new Date().toISOString();
    updates.decline_reason = data.decline_reason ?? null;
  }

  const { error: updateError } = await admin
    .from("contract")
    .update(updates)
    .eq("contract_id", contract.contract_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Log to contract_event (new immutable audit trail)
  await admin.from("contract_event").insert({
    contract_id: contract.contract_id,
    workspace_id: contract.workspace_id,
    event_type: event_type.replace(".", "_"),
    actor_type: "webhook",
    details: {
      docuseal_event: event_type,
      submission_id: data.submission_id,
      new_status: newStatus,
    } as unknown as Json,
    ip_address: request.headers.get("x-forwarded-for") ?? null,
  });

  // Audit log (system action — sentinel UUID for system entries)
  await admin.from("platform_audit_log").insert({
    super_admin_id: "00000000-0000-0000-0000-000000000000",
    action: `docuseal_${event_type}`,
    entity_type: "contract",
    entity_id: contract.contract_id,
    details: {
      event_type,
      submission_id: data.submission_id,
      new_status: newStatus,
    } as unknown as Json,
  });

  // On decline: cancel pending reminders
  if (newStatus === "declined") {
    await admin
      .from("contract_reminder")
      .update({ status: "skipped", skip_reason: "contract_declined" })
      .eq("contract_id", contract.contract_id)
      .eq("status", "scheduled");

    // For employee contracts, also update employment_contract status.
    // "terminated" is the closest valid enum value for declined/cancelled contracts.
    if (contract.contract_type === "employee") {
      await admin
        .from("employment_contract")
        .update({
          status: "terminated" as Database["public"]["Enums"]["contract_status"],
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("signing_contract_id", contract.contract_id);
    }
  }

  // On signing: fetch audit log + documents from DocuSeal via contract-service
  if (newStatus === "signed") {
    try {
      const { callContractService, isContractServiceConfigured } =
        await import("@/lib/contract-service");
      if (isContractServiceConfigured()) {
        void callContractService(`/contracts/${contract.contract_id}/fetch-documents`, {
          method: "POST",
        });
      }
    } catch {
      // Non-critical — documents can be fetched manually later
    }
  }

  // On signing: cancel pending reminders + branch on contract_type
  if (newStatus === "signed" && contract.workspace_id) {
    // Cancel reminders for all contract types
    await admin
      .from("contract_reminder")
      .update({ status: "skipped", skip_reason: "contract_signed" })
      .eq("contract_id", contract.contract_id)
      .eq("status", "scheduled");

    if (contract.contract_type === "employee") {
      // Sync signing status to employment_contract — status = 'active' per
      // ADR-0241 enum (signed is intermediate; active = D2 cascade coupling trigger)
      await admin
        .from("employment_contract")
        .update({
          status: "active" as never,
          document_url: updates.signed_pdf_url ?? null,
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("signing_contract_id", contract.contract_id);

      // Emit engine_event for cascade coupling: D2 active + C4 trainee→active transition
      // The engine_event drives profile_status update (trainee → active) via engine_process.
      if (contract.workspace_id) {
        void Promise.resolve(
          admin.from("engine_event").insert({
            workspace_id: contract.workspace_id,
            entity_type: "employment_contract",
            entity_id: contract.contract_id,
            event_name: "contract.signed",
            payload: {
              signed_at: new Date().toISOString(),
              contract_type: "employee",
            },
            created_at: new Date().toISOString(),
          } as never),
        ).catch(() => {
          // engine_event table may not exist yet in all envs — non-blocking
        });
      }
    } else {
      // SaaS contracts: update workspace contract status (existing behavior)
      await admin
        .from("workspace")
        .update({
          contract_status: "active",
          active_contract_id: contract.contract_id,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", contract.workspace_id);
    }
  }

  // Emit telemetry
  const emitBase = {
    workspace_id: nonEmpty(contract.workspace_id, "workspace_id"),
    actor_id: nonEmpty("system", "actor_id"),
  };
  const entity = { entity_type: "contract" as const, entity_id: contract.contract_id };

  if (newStatus === "viewed") {
    void emit({
      ...emitBase,
      event: "contract viewed",
      properties: { entity, data: { recipient_email: "" } },
    });
  } else if (newStatus === "signed") {
    void emit({
      ...emitBase,
      event: "contract signed",
      properties: {
        entity,
        data: { recipient_email: "", signed_pdf_url: updates.signed_pdf_url ?? undefined },
      },
    });
  } else if (newStatus === "declined") {
    void emit({
      ...emitBase,
      event: "contract declined",
      properties: { entity, data: { reason: data.decline_reason ?? undefined } },
    });
  } else if (newStatus === "expired") {
    void emit({
      ...emitBase,
      event: "contract expired",
      properties: { entity, data: { expired_at: new Date().toISOString() } },
    });
  }

  return NextResponse.json({ received: true, status: newStatus });
}
