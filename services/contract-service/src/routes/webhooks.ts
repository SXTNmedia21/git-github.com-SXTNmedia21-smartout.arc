/**
 * DEPRECATED: Use /api/webhooks/docuseal in the Next.js app (apps/web).
 * That handler is deployed on Vercel and handles the full lifecycle:
 * status update, workspace activation, reminder cancellation, audit logging.
 * This handler is kept for reference and local development only.
 */
import type { FastifyInstance } from "fastify";
import { supabase } from "../lib/supabase.js";
import { config } from "../config.js";

type WebhookPayload = {
  event_type: string;
  timestamp: string;
  data: {
    id: number;
    submission_id: number;
    email: string;
    role: string;
    status: string;
    completed_at?: string;
    declined_at?: string;
    decline_reason?: string;
    documents?: Array<{ url: string; filename: string }>;
    submitters?: Array<{
      id: number;
      email: string;
      role: string;
      completed_at?: string;
      name?: string;
    }>;
    values?: Array<{ field: string; value: string }>;
  };
};

const STATUS_WEIGHT: Record<string, number> = {
  draft: 0,
  sent: 1,
  viewed: 2,
  signed: 3,
  expired: 3,
  cancelled: 3,
  declined: 3,
};

export async function webhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/docuseal", async (request, reply) => {
    // Verify shared secret
    const secret = request.headers["x-docuseal-secret"] ?? request.headers["x-docuseal-signature"];
    if (secret !== config.DOCUSEAL_WEBHOOK_SECRET) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { event_type, data } = request.body as WebhookPayload;

    // Map DocuSeal events to contract statuses
    const eventToStatus: Record<string, string> = {
      "form.viewed": "viewed",
      "form.started": "viewed",
      "form.completed": "signed",
      "form.declined": "declined",
      "submission.completed": "signed",
      "submission.expired": "expired",
    };

    const newStatus = eventToStatus[event_type];
    if (!newStatus) {
      return { received: true, event_type, action: "ignored" };
    }

    // Find contract by DocuSeal submission ID
    const { data: contract, error } = await supabase
      .from("contract")
      .select("contract_id, status, workspace_id")
      .eq("docuseal_submission_id", String(data.submission_id))
      .single();

    if (error || !contract) {
      app.log.warn(`No contract found for submission ${data.submission_id}`);
      return reply.status(404).send({ error: "Contract not found" });
    }

    // Prevent status regression (Learning L-0004)
    const currentWeight = STATUS_WEIGHT[contract.status] ?? 0;
    const newWeight = STATUS_WEIGHT[newStatus] ?? 0;
    if (newWeight <= currentWeight) {
      return { received: true, action: "skipped", reason: "status_not_advanced" };
    }

    // Build update payload
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (event_type === "form.viewed") {
      updates.viewed_at = new Date().toISOString();
    }

    if (newStatus === "signed") {
      updates.signed_at = data.completed_at ?? new Date().toISOString();
      if (data.documents?.[0]?.url) {
        updates.signed_pdf_url = data.documents[0].url;
      }
    }

    if (newStatus === "declined") {
      updates.declined_at = data.declined_at ?? new Date().toISOString();
      updates.decline_reason = data.decline_reason ?? null;
    }

    // Update contract
    await supabase.from("contract").update(updates).eq("contract_id", contract.contract_id);

    // Log event
    await supabase.from("contract_event").insert({
      contract_id: contract.contract_id,
      workspace_id: contract.workspace_id,
      event_type: event_type.replace(".", "_"),
      actor_type: "webhook",
      details: {
        docuseal_event: event_type,
        submitter_email: data.email,
        submitter_role: data.role,
      },
      ip_address: request.ip,
    });

    // On signing: cancel pending reminders + update workspace
    if (newStatus === "signed") {
      await Promise.all([
        // Cancel reminders
        supabase
          .from("contract_reminder")
          .update({ status: "skipped", skip_reason: "contract_signed" })
          .eq("contract_id", contract.contract_id)
          .eq("status", "scheduled"),

        // Update workspace contract status
        supabase
          .from("workspace")
          .update({
            contract_status: "active",
            active_contract_id: contract.contract_id,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", contract.workspace_id),
      ]);
    }

    return { received: true, contract_id: contract.contract_id, new_status: newStatus };
  });
}
