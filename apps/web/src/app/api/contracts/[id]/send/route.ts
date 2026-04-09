/**
 * POST /api/contracts/[id]/send — attempt to send a draft contract via DocuSeal.
 *
 * Resilient pattern: if the contract-service microservice is down or unreachable,
 * the contract is marked as "draft" with send_requested_at timestamp and a
 * contract_event is logged. The contract will be sent when the service comes
 * online (via a retry sweep or manual re-send).
 *
 * The caller always gets a success response (202) so the UI can show "sendt"
 * and the contract appears in the correct bucket.
 */
import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit } from "@smartout/telemetry";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("contract")
    .select("contract_id, status, workspace_id, recipient_email")
    .eq("contract_id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Try to send via contract-service (DocuSeal). If it fails, log and continue.
  let sendSucceeded = false;
  let sendError: string | null = null;

  if (isContractServiceConfigured()) {
    try {
      const res = await callContractService(`/contracts/${id}/send`, {
        method: "POST",
        headers: { "X-User-Id": user.id },
      });

      if (res.ok) {
        sendSucceeded = true;

        // Update contract status to "sent"
        await admin
          .from("contract")
          .update({ status: "sent", updated_at: new Date().toISOString() })
          .eq("contract_id", id);
      } else {
        const body = await res.json().catch(() => ({}));
        sendError = (body as { error?: string }).error ?? `Service returned ${res.status}`;
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : "Contract service unreachable";
    }
  } else {
    sendError = "Contract service not configured (CONTRACT_SERVICE_URL / CONTRACT_SERVICE_KEY)";
  }

  // If send failed, log the failure and mark for retry — but don't block the user.
  if (!sendSucceeded) {
    // Log the send attempt as a contract event for audit + retry
    await admin.from("contract_event").insert({
      contract_id: id,
      workspace_id: contract.workspace_id,
      event_type: "send_failed",
      actor_type: "system",
      actor_id: user.id,
      metadata: { error: sendError, attempted_at: new Date().toISOString() },
    });

    // Update metadata to flag for retry
    await admin
      .from("contract")
      .update({
        metadata: { send_requested_at: new Date().toISOString(), send_error: sendError },
        updated_at: new Date().toISOString(),
      })
      .eq("contract_id", id);

    console.error(`[contracts/send] Failed to send contract ${id}: ${sendError}`);
  }

  // Log success event
  await admin.from("contract_event").insert({
    contract_id: id,
    workspace_id: contract.workspace_id,
    event_type: sendSucceeded ? "sent" : "send_queued",
    actor_type: "user",
    actor_id: user.id,
  });

  void emit({
    event: "contract sent",
    workspace_id: contract.workspace_id ?? "",
    actor_id: user.id,
    properties: {
      entity: { entity_type: "contract", entity_id: id },
      data: {
        recipient_email: contract.recipient_email ?? "",
        expires_at: "",
      },
    },
  });

  // Always return 202 — the contract is either sent or queued for retry
  return NextResponse.json(
    {
      contract_id: id,
      status: sendSucceeded ? "sent" : "queued",
      message: sendSucceeded
        ? "Kontrakt sendt til ansatt for signering"
        : "Kontrakt lagret — sending utsatt (tjenesten er midlertidig utilgjengelig)",
      send_error: sendError,
    },
    { status: 202 },
  );
}
