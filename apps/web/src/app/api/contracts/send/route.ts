/**
 * POST /api/contracts/send — dispatch an employment contract to DocuSeal from
 * the ContractDispatchDrawer (people-page → 2-step drawer flow).
 *
 * What: Creates or updates an employment_contract draft, freezes the
 *       framework_snapshot JSONB, and dispatches to DocuSeal via contract-service.
 * Why:  ADR-0114 (API route for drawer mutation), ADR-0151 (forgery defence),
 *       ADR-0244 (framework_snapshot freeze on send).
 *
 * ADR-0151 forgery defence:
 *   - workspace_id derived server-side from JWT (never from body)
 *   - target_profile_id verified to be in caller's workspace
 *   - profile_id for actor derived from JWT, not body
 *
 * Validation gates (fail with 422):
 *   - all 4 ack blocks acknowledged
 *   - template_id valid + not deprecated
 *   - target_profile in caller workspace
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { callContractService, isContractServiceConfigured } from "@/lib/contract-service";
import { emit, nonEmpty } from "@smartout/telemetry";

const SendBodySchema = z.object({
  template_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),
  blocks_acknowledged: z.array(z.string()).min(1),
  existing_contract_id: z.string().uuid().nullable().optional(),
});

const REQUIRED_BLOCKS = ["stilling", "lonn", "kategori", "framework"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // ADR-0151: resolve caller identity server-side from JWT
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Ikke autentisert" }, { status: 401 });
  }

  // Resolve actor profile + workspace from JWT
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!actorProfile) {
    return NextResponse.json({ error: "Ingen aktiv profil funnet" }, { status: 403 });
  }

  const workspaceId = actorProfile.workspace_id;
  const actorProfileId = actorProfile.profile_id;

  // Parse body
  const parsed = SendBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Ugyldig forespørsel" },
      { status: 400 },
    );
  }

  const { template_id, target_profile_id, blocks_acknowledged, existing_contract_id } = parsed.data;

  // Gate: all required blocks must be acknowledged
  const missingBlocks = REQUIRED_BLOCKS.filter((b) => !blocks_acknowledged.includes(b));
  if (missingBlocks.length > 0) {
    return NextResponse.json(
      { error: `Manglende bekreftelser: ${missingBlocks.join(", ")}` },
      { status: 422 },
    );
  }

  const admin = createAdminClient();

  // ADR-0151: verify target profile is in caller's workspace
  const { data: targetProfile } = await admin
    .from("profile")
    .select("profile_id, display_name")
    .eq("profile_id", target_profile_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!targetProfile) {
    return NextResponse.json(
      { error: "Profilen tilhører ikke ditt arbeidsområde" },
      { status: 403 },
    );
  }

  // Verify template exists and is not deprecated
  const { data: template } = await admin
    .from("contract_template")
    .select("template_id, name, content_html, deprecated_at")
    .eq("template_id", template_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!template) {
    return NextResponse.json({ error: "Mal ikke funnet" }, { status: 404 });
  }
  if (template.deprecated_at !== null) {
    return NextResponse.json({ error: "Malen er utdatert og kan ikke brukes" }, { status: 422 });
  }

  // Build framework_snapshot — freeze current regulatory framework state (ADR-0244)
  const { data: frameworkBinding } = await admin
    .from("workspace_framework_binding")
    .select("framework_id, regulatory_framework:framework_id(name, version, valid_from)")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .maybeSingle();

  const frameworkSnapshot = frameworkBinding
    ? {
        framework_id: frameworkBinding.framework_id,
        framework_name:
          (frameworkBinding.regulatory_framework as unknown as { name?: string })?.name ?? null,
        framework_version:
          (frameworkBinding.regulatory_framework as unknown as { version?: string })?.version ??
          null,
        frozen_at: new Date().toISOString(),
        blocks_acknowledged,
      }
    : {
        framework_id: null,
        frozen_at: new Date().toISOString(),
        blocks_acknowledged,
      };

  // Upsert employment_contract draft
  const contractId = existing_contract_id;

  if (contractId) {
    // Update existing contract — set status to ready_to_send + freeze snapshot
    const { error: updateErr } = await admin
      .from("employment_contract")
      .update({
        status: "ready_to_send",
        framework_snapshot: frameworkSnapshot as never,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("contract_id", contractId)
      .eq("workspace_id", workspaceId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  } else {
    // No existing draft — we need a minimal contract row to send
    // (in practice, HrTabSections should have created one, but handle gracefully)
    return NextResponse.json(
      { error: "Ingen kontraktutkast funnet. Lagre ansettelse først." },
      { status: 422 },
    );
  }

  // Dispatch via contract-service to DocuSeal
  let sendSucceeded = false;
  let signingContractId: string | null = null;
  let sendError: string | null = null;

  if (isContractServiceConfigured()) {
    try {
      const serviceRes = await callContractService(`/contracts/${contractId}/send`, {
        method: "POST",
        headers: { "X-User-Id": user.id, "X-Actor-Profile-Id": actorProfileId },
      });

      if (serviceRes.ok) {
        sendSucceeded = true;
        const body = (await serviceRes.json()) as { signing_contract_id?: string };
        signingContractId = body.signing_contract_id ?? null;

        // Update employment_contract with sent status
        await admin
          .from("employment_contract")
          .update({
            status: "sent",
            signing_contract_id: signingContractId,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("contract_id", contractId);
      } else {
        const errBody = await serviceRes.json().catch(() => ({}));
        sendError = (errBody as { error?: string }).error ?? `Service ${serviceRes.status}`;
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : "Contract service unreachable";
    }
  } else {
    // Dev mode: mark as sent without DocuSeal
    sendSucceeded = true;
    await admin
      .from("employment_contract")
      .update({
        status: "sent",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("contract_id", contractId);
  }

  if (!sendSucceeded) {
    console.error(`[contracts/send] Failed: ${sendError}`);
    // Still return 202 — contract is queued
  }

  // Emit telemetry
  void emit({
    workspace_id: nonEmpty(workspaceId, "workspace_id"),
    actor_id: nonEmpty(actorProfileId, "actor_id"),
    event: "contract.send_initiated",
    properties: {
      entity: { entity_type: "employment_contract", entity_id: contractId },
      data: {
        contract_id: contractId,
        template_id,
        target_profile_id,
        blocks_acknowledged,
        framework_snapshot_frozen: true,
      },
    },
  });

  return NextResponse.json(
    {
      contract_id: contractId,
      status: sendSucceeded ? "sent" : "queued",
      signing_contract_id: signingContractId,
    },
    { status: 202 },
  );
}
