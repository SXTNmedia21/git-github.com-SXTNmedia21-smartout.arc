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
import type { AgentToolContext } from "@smartout/ai/capabilities/types";
import { validateAml146 } from "@smartout/ai/capabilities/legal/tools";
import { gateAction } from "@/app/dashboard/_actions/_shared";

const SendBodySchema = z.object({
  template_id: z.string().uuid(),
  target_profile_id: z.string().uuid(),
  blocks_acknowledged: z.array(z.string()).min(1),
  existing_contract_id: z.string().uuid().nullable().optional(),
  resolved_html: z.string().optional(),
  // SMA-310 / ADR-0310: server-enforced PDF preview gate.
  // Required — client must send the timestamp when admin confirmed PDF read.
  pdf_preview_viewed_at: z.string().datetime(),
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
    .select("profile_id, workspace_id, display_name")
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

  const {
    template_id,
    target_profile_id,
    blocks_acknowledged,
    existing_contract_id,
    resolved_html,
    pdf_preview_viewed_at,
  } = parsed.data;

  // Gate: all required blocks must be acknowledged
  const missingBlocks = REQUIRED_BLOCKS.filter((b) => !blocks_acknowledged.includes(b));
  if (missingBlocks.length > 0) {
    return NextResponse.json(
      { error: `Manglende bekreftelser: ${missingBlocks.join(", ")}` },
      { status: 422 },
    );
  }

  // SMA-310 / ADR-0310: server-validate PDF preview gate timestamp.
  // Must be a valid past timestamp — future timestamps indicate a forged request.
  const pdfViewedAt = new Date(pdf_preview_viewed_at);
  if (isNaN(pdfViewedAt.getTime()) || pdfViewedAt > new Date()) {
    return NextResponse.json(
      {
        error: "pdf_preview_viewed_at must be a valid past timestamp",
        code: "INVALID_PDF_GATE",
        // i18n_key: client renders localized message from this key (CLAUDE.md i18n constraint).
        i18n_key: "contracts.send.errors.invalid_pdf_gate",
      },
      { status: 422 },
    );
  }

  const admin = createAdminClient();

  // Resolve actor email from auth.users — used as sender_email on stub contract row + notifications.
  // Fallback to "post@smartout.no" so the flow is never blocked by a lookup failure.
  let actorEmail = "post@smartout.no";
  try {
    const { data: actorAuthUser } = await admin.auth.admin.getUserById(user.id);
    if (actorAuthUser.user?.email) {
      actorEmail = actorAuthUser.user.email;
    }
  } catch {
    // Non-fatal — keep fallback
  }

  // ADR-0151: verify target profile is in caller's workspace
  const { data: targetProfile } = await admin
    .from("profile")
    .select(
      "profile_id, display_name, personal_number, bank_account, address_line_1, postal_code, city",
    )
    .eq("profile_id", target_profile_id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!targetProfile) {
    return NextResponse.json(
      { error: "Profilen tilhører ikke ditt arbeidsområde" },
      { status: 403 },
    );
  }

  // SMA-305 + SMA-314 follow-up: completeness gate combines PII + employment fields.
  // Returns 422 with structured missing_fields[] so the drawer can open MissingInfoSheet.
  type MissingField = {
    field: string;
    label_no: string;
    section: string;
    tier: "lav" | "medium" | "hoy";
  };
  const missingFields: MissingField[] = [];

  // PII checks (Personalia / Økonomi / Adresse)
  if (!(targetProfile as { personal_number?: string | null }).personal_number) {
    missingFields.push({
      field: "personal_number",
      label_no: "Personnummer",
      section: "Personalia",
      tier: "hoy",
    });
  }
  if (!(targetProfile as { bank_account?: string | null }).bank_account) {
    missingFields.push({
      field: "bank_account",
      label_no: "Kontonummer",
      section: "Økonomi",
      tier: "hoy",
    });
  }
  // Granular address fields — RPC `admin_submit_employee_pii` writes
  // address_line_1/postal_code/city per key. Single "address" key would be
  // silently dropped (NULLs written), creating a 422-retry loop.
  if (!(targetProfile as { address_line_1?: string | null }).address_line_1) {
    missingFields.push({
      field: "address_line_1",
      label_no: "Gateadresse",
      section: "Adresse",
      tier: "lav",
    });
  }
  if (!(targetProfile as { postal_code?: string | null }).postal_code) {
    missingFields.push({
      field: "postal_code",
      label_no: "Postnummer",
      section: "Adresse",
      tier: "lav",
    });
  }
  if (!(targetProfile as { city?: string | null }).city) {
    missingFields.push({
      field: "city",
      label_no: "Poststed",
      section: "Adresse",
      tier: "lav",
    });
  }

  // Employment-contract checks (Ansettelse) — find latest draft / pending_data row.
  const { data: existingDraft } = await admin
    .from("employment_contract")
    .select(
      "contract_id, status, position_title, start_date, hourly_rate, monthly_salary, employment_percentage, agreed_weekly_hours",
    )
    .eq("workspace_id", workspaceId)
    .eq("profile_id", target_profile_id)
    .in("status", ["draft", "pending_data", "ready_to_send"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 5 employment fields per Pontus 2026-05-06: stilling / tiltrede / lønn / prosent / timer
  if (!existingDraft || !existingDraft.position_title) {
    missingFields.push({
      field: "position_title",
      label_no: "Stilling",
      section: "Ansettelse",
      tier: "lav",
    });
  }
  if (!existingDraft || !existingDraft.start_date) {
    missingFields.push({
      field: "start_date",
      label_no: "Tiltredelsesdato",
      section: "Ansettelse",
      tier: "lav",
    });
  }
  if (
    !existingDraft ||
    (existingDraft.hourly_rate === null && existingDraft.monthly_salary === null)
  ) {
    missingFields.push({
      field: "hourly_rate",
      label_no: "Timelønn (NOK)",
      section: "Ansettelse",
      tier: "lav",
    });
  }
  if (!existingDraft || existingDraft.employment_percentage === null) {
    missingFields.push({
      field: "employment_percentage",
      label_no: "Stillingsprosent (%)",
      section: "Ansettelse",
      tier: "lav",
    });
  }
  if (!existingDraft || existingDraft.agreed_weekly_hours === null) {
    missingFields.push({
      field: "agreed_weekly_hours",
      label_no: "Ukentlig arbeidstid (timer)",
      section: "Ansettelse",
      tier: "lav",
    });
  }

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: "missing_employment_data",
        user_message_no: "Ansatten mangler nødvendig informasjon for å sende kontrakt.",
        missing_fields: missingFields,
        blockers: [
          {
            rule_id: "completeness",
            message: `Mangler ${missingFields.length} felt: ${missingFields.map((f) => f.field).join(", ")}`,
          },
        ],
      },
      { status: 422 },
    );
  }

  // Verify template exists and is not deprecated. Accept both:
  //  - workspace-owned templates (workspace_id matches caller)
  //  - K1a system templates (workspace_id IS NULL) — pre-published seed templates
  // Drawer's filter mirrors this; without `is.null` the lookup 406s when
  // user picks a system template.
  const { data: template } = await admin
    .from("contract_template")
    .select("template_id, name, content_html, deprecated_at, workspace_id")
    .eq("template_id", template_id)
    .or(`workspace_id.eq.${workspaceId},workspace_id.is.null`)
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
    .select("framework_id, regulatory_framework:framework_id(name, version)")
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

  // Upsert employment_contract draft. Drawer often opens without an
  // existing_contract_id (compose flow from contracts hub). Look up any
  // active draft for this profile before erroring — the people-page
  // authoring step or a prior compose attempt may have left one.
  let contractId = existing_contract_id ?? null;

  if (!contractId) {
    // Lookup any not-yet-final contract for this profile. Authoring leaves
    // contracts in 'draft' or 'pending_data'; either is dispatchable.
    // Excludes terminal states (sent, signed, active, terminated, etc).
    const { data: latestDraft } = await admin
      .from("employment_contract")
      .select("contract_id, status")
      .eq("workspace_id", workspaceId)
      .eq("profile_id", target_profile_id)
      .in("status", ["draft", "pending_data", "ready_to_send"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    contractId = latestDraft?.contract_id ?? null;
  }

  if (contractId) {
    // SMA-311 / ADR-0309: C4 gateAction before UPDATE mutation (5th route — Q-H2).
    // Mirrors bulk route pattern (employment-contracts/bulk/route.ts:135-142).
    const gateResult = await gateAction({
      workspaceId,
      capability: "contract",
      channel: "system",
      actorProfileId: actorProfileId,
      actionType: "send_dispatch",
      entityId: contractId,
    });

    if (!gateResult.allow) {
      void emit({
        event: "gate.contract_send_denied",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: { entity_type: "employment_contract", entity_id: contractId },
          data: {
            contract_id: contractId,
            capability: "contract",
            action_type: "send_dispatch",
            reason: gateResult.reason,
            denied_by: "gate_action",
          },
        },
      });
      return NextResponse.json(
        { error: "gate_denied", reason: gateResult.reason, denied_by: "gate_action" },
        { status: 403 },
      );
    }

    // Update existing contract — set status to ready_to_send + freeze snapshot
    // SMA-310 / ADR-0310: persist pdf_preview_viewed_at server-side.
    const { error: updateErr } = await admin
      .from("employment_contract")
      .update({
        status: "ready_to_send",
        framework_snapshot: frameworkSnapshot as never,
        pdf_preview_viewed_at,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("contract_id", contractId)
      .eq("workspace_id", workspaceId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // SMA-310 / ADR-0310: post-persist verification — confirm pdf_preview_viewed_at was stored.
    // Fail 422 if column is NULL after update (infrastructure failure or RLS rewrite).
    const { data: verifyRow } = await admin
      .from("employment_contract")
      .select("pdf_preview_viewed_at")
      .eq("contract_id", contractId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!verifyRow?.pdf_preview_viewed_at) {
      void emit({
        event: "contract.pdf_gate.bypassed_attempt",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorProfileId, "actor_id"),
        properties: {
          entity: { entity_type: "employment_contract", entity_id: contractId },
          data: { contract_id: contractId, reason: "not_persisted" },
        },
      });
      return NextResponse.json(
        {
          error: "PDF gate timestamp could not be persisted",
          code: "PDF_GATE_NOT_PERSISTED",
          i18n_key: "contracts.send.errors.pdf_gate_not_persisted",
        },
        { status: 422 },
      );
    }

    void emit({
      event: "contract.pdf_gate.enforced",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: { entity_type: "employment_contract", entity_id: contractId },
        data: { contract_id: contractId, pdf_preview_viewed_at },
      },
    });
  } else {
    // No existing draft AND no draft found via lookup. Authoring step
    // (people-page → Ansettelse → Lagre) must run first to insert a
    // draft row with employment_form and the §14-6 fields.
    return NextResponse.json(
      {
        error:
          "Ingen kontraktutkast funnet for denne ansatte. Gå til ansatt-siden, fyll ut Ansettelse-seksjonen og lagre før du sender.",
      },
      { status: 422 },
    );
  }

  // §14-6 compliance gate — Lovsen capability (ADR-0249 / CAPABILITY-legal.md).
  // Runs BEFORE DocuSeal dispatch. Stub returns pass=true at Phase 0c;
  // Phase 0c+ wires real Lovdata MCP validation.
  // channel: "system" — API route is server-side, not a chat session.
  // ADR-0151: workspace_id + profileId derived from JWT (already resolved above).
  const legalCtx: AgentToolContext = {
    workspaceId: nonEmpty(workspaceId, "workspace_id"),
    profileId: nonEmpty(actorProfileId, "actor_id"),
    userId: user.id,
    sessionId: `contracts-send:${contractId}`,
    supabaseAdmin: admin,
    channel: "system",
  };

  const aml146Raw = await validateAml146.execute(
    { contract_id: contractId, validation_mode: "strict" },
    legalCtx,
  );

  let aml146Result: {
    pass?: boolean;
    status?: string;
    errors?: Array<{
      severity: string;
      paragraph: string;
      field: string;
      message_no: string;
      remediation: string;
    }>;
    warnings?: Array<unknown>;
  };
  try {
    aml146Result = JSON.parse(aml146Raw) as typeof aml146Result;
  } catch {
    aml146Result = { pass: false, errors: [], warnings: [] };
  }

  if (aml146Result.pass === false) {
    return NextResponse.json(
      {
        error: "Kontrakten oppfyller ikke alle krav i Aml. §14-6. Rett feilene og prøv igjen.",
        aml_errors: aml146Result.errors ?? [],
        aml_status: aml146Result.status ?? "missing_fields",
      },
      { status: 422 },
    );
  }

  // Dispatch via contract-service to DocuSeal
  let sendSucceeded = false;
  let signingContractId: string | null = null;
  let sendError: string | null = null;

  if (isContractServiceConfigured()) {
    try {
      // Bridge: contract-service operates on `contract` (DocuSeal signing entity),
      // not employment_contract. Resolve or create the signing-contract row first.
      const { data: empExisting } = await admin
        .from("employment_contract")
        .select("signing_contract_id")
        .eq("contract_id", contractId)
        .single();

      signingContractId =
        (empExisting as { signing_contract_id: string | null } | null)?.signing_contract_id ?? null;

      if (!signingContractId) {
        // Create signing row via service POST /contracts.
        // Recipient email comes from user_identity; profile join not always present.
        const { data: recipientProfileRow } = await admin
          .from("profile")
          .select("display_name, user_id")
          .eq("profile_id", target_profile_id)
          .single();
        const recipientUserId = (recipientProfileRow as { user_id?: string } | null)?.user_id;
        const { data: recipientIdentity } = recipientUserId
          ? await admin
              .from("user_identity")
              .select("email")
              .eq("user_id", recipientUserId)
              .single()
          : { data: null };
        const recipientEmail = (recipientIdentity as { email?: string } | null)?.email ?? null;

        if (!recipientEmail) {
          sendError = "Mottaker mangler e-post — kontrakten kan ikke sendes til signering";
        } else {
          const createRes = await callContractService("/contracts", {
            method: "POST",
            body: JSON.stringify({
              template_id,
              workspace_id: workspaceId,
              contract_type: "employee",
              recipient_name:
                (recipientProfileRow as { display_name?: string } | null)?.display_name ?? "",
              recipient_email: recipientEmail,
              ...(resolved_html ? { resolved_html } : {}),
            }),
            headers: { "X-User-Id": user.id, "X-Actor-Profile-Id": actorProfileId },
          });
          if (createRes.ok) {
            const created = (await createRes.json()) as { contract_id?: string };
            signingContractId = created.contract_id ?? null;
            if (signingContractId) {
              await admin
                .from("employment_contract")
                .update({
                  signing_contract_id: signingContractId,
                  updated_at: new Date().toISOString(),
                } as never)
                .eq("contract_id", contractId);
            }
          } else {
            const errBody = await createRes.json().catch(() => ({}));
            sendError =
              (errBody as { error?: string }).error ?? `Service create ${createRes.status}`;
          }
        }
      }

      // Dispatch /send only when we resolved a signing row + had no prior error.
      if (signingContractId && !sendError) {
        const serviceRes = await callContractService(`/contracts/${signingContractId}/send`, {
          method: "POST",
          headers: { "X-User-Id": user.id, "X-Actor-Profile-Id": actorProfileId },
        });

        if (serviceRes.ok) {
          sendSucceeded = true;
          await admin
            .from("employment_contract")
            .update({
              status: "sent",
              updated_at: new Date().toISOString(),
            } as never)
            .eq("contract_id", contractId);
        } else {
          const errBody = await serviceRes.json().catch(() => ({}));
          sendError = (errBody as { error?: string }).error ?? `Service ${serviceRes.status}`;
        }
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : "Contract service unreachable";
    }
  }

  // SMA-307 / ADR-0309: Walt dev-stub branch REMOVED entirely.
  // Service-down state is always 503 in all environments — no synthetic DB state.
  // Principle: "no synthetic database state for environment convenience."
  // CONTRACT_SERVICE_DEV_FALLBACK env flag also removed from env.ts + .env.template.
  // Dev affordance moved to UI: /walt/sign-dev/[contract_id]/page.tsx reads
  // employment_contract directly — no stub contract row ever inserted.
  if (!sendSucceeded) {
    console.error(`[contracts/send] CONTRACT_SERVICE_DOWN: ${sendError ?? "unknown"}`, {
      contract_id: contractId,
      workspace_id: workspaceId,
    });

    void emit({
      event: "contract.send_failed.service_down",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorProfileId, "actor_id"),
      properties: {
        entity: { entity_type: "employment_contract", entity_id: contractId },
        data: { error: sendError ?? "unknown", contract_id: contractId },
      },
    });

    return NextResponse.json(
      {
        error: "Kontrakt-tjenesten er utilgjengelig. Prøv igjen om 1 minutt eller kontakt support.",
        code: "CONTRACT_SERVICE_DOWN",
        retry_after_seconds: 60,
      },
      { status: 503 },
    );
  }

  if (!sendSucceeded) {
    console.error(`[contracts/send] Failed: ${sendError}`);
    // Still return 202 — contract is queued
  }

  // Notifications on successful send — non-blocking (log warning, never 500).
  // Admin client required: RLS on notification table requires service role for cross-profile writes.
  if (sendSucceeded) {
    const positionTitle = existingDraft?.position_title ?? "";
    const actorDisplayName = (actorProfile as { display_name?: string | null }).display_name ?? "";
    const employeeDisplayName =
      (targetProfile as { display_name?: string | null }).display_name ?? "";

    const employeeNotifResult = await admin.from("notification").insert({
      workspace_id: workspaceId,
      recipient_id: target_profile_id,
      title: "Du har fått en ny arbeidsavtale",
      body: `${actorDisplayName} har sendt deg arbeidsavtalen for ${positionTitle}. Logg inn for å se og signere.`,
      action_url: "/dashboard/my-contract",
      icon_type: "info",
      metadata: {
        contract_id: contractId,
        signing_contract_id: signingContractId,
        type: "contract_received",
      },
    });
    if (employeeNotifResult.error) {
      console.warn(
        "[contracts/send] Employee notification insert failed:",
        employeeNotifResult.error.message,
      );
    }

    const employerNotifResult = await admin.from("notification").insert({
      workspace_id: workspaceId,
      recipient_id: actorProfileId,
      title: "Du må signere arbeidsavtalen",
      body: `Arbeidsavtalen for ${employeeDisplayName} (${positionTitle}) venter din signatur.`,
      action_url: "/dashboard/people/contracts/awaiting-my-signature",
      icon_type: "info",
      metadata: {
        contract_id: contractId,
        signing_contract_id: signingContractId,
        type: "employer_signature_required",
      },
    });
    if (employerNotifResult.error) {
      console.warn(
        "[contracts/send] Employer notification insert failed:",
        employerNotifResult.error.message,
      );
    }
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
