/**
 * POST /api/employment-contracts/[id]/send — Send a draft employment contract.
 *
 * Steps (in order):
 *  1. Auth — get user, load employment_contract
 *  2. Guard — must be status='draft'. If signing_contract_id already set → return success (idempotent)
 *  3. Role gate — require admin or owner in workspace
 *  4. Snapshot active framework rules (workspace_framework_binding → framework_rule)
 *  5. Check PII — personal_number, bank_account, address. Determine missing groups.
 *  6. Resolve template — contract_template where contract_type='employee' + employment_category match
 *  7. Load company via workspace.company_id for placeholder resolution
 *  8. Resolve placeholders — replace {{key}} in template HTML
 *  9. INSERT contract row (DocuSeal signing entity) → SELECT back contract_id
 * 10. UPDATE employment_contract — status, framework_snapshot, signing_contract_id
 * 11. INSERT contract_event — event_type='created'
 * 12. Call contract-service (if PII complete) — non-blocking, failure logs send_failed event
 * 13. Create engine_state — 'contract_signing' or 'contract_data_intake'
 * 14. Schedule escalation triggers (day 3, 7, 10) if pending_data
 * 15. Emit telemetry — 'contract sent'. If pending_data also emit 'contract intake started'.
 * 16. Return { sent, status, contract_id, signing_contract_id, pii_complete }
 *
 * Idempotency: signing_contract_id presence is the guard — a second call returns
 * early (step 2) without side effects.
 *
 * ADR-0076: composition as cascade derivation.
 * ADR-0077: PII handling — intake flow for missing data.
 * ADR-0078: channel restriction — critical PII never via voice.
 */

import { NextResponse } from "next/server";
import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { emit, nonEmpty } from "@smartout/telemetry";
import { gateAction } from "@/app/dashboard/_actions/_shared";
const CONTRACT_SERVICE_URL = process.env.CONTRACT_SERVICE_URL ?? "http://localhost:5012";
const CONTRACT_SERVICE_KEY = process.env.CONTRACT_SERVICE_KEY ?? "";

// Placeholder keys defined in the seed templates. Order matters for readability,
// not for correctness — replaceAll handles each independently.
const PLACEHOLDER_KEYS = [
  "arbeidsgiver_navn",
  "arbeidsgiver_org_nr",
  "ansatt_navn",
  "ansatt_personnummer",
  "ansatt_adresse",
  "stilling",
  "maanedslonn",
  "timelonn",
  "stillingsprosent",
  "kontraktdato",
  "startdato",
] as const;

type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

function resolvePlaceholders(
  html: string,
  values: Partial<Record<PlaceholderKey, string>>,
): string {
  return PLACEHOLDER_KEYS.reduce((resolved, key) => {
    const value = values[key] ?? "";
    // Replace every occurrence of {{key}} in the template HTML.
    return resolved.replaceAll(`{{${key}}}`, value);
  }, html);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Step 1: Auth — get user ──────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load employment_contract first to get workspace_id for role check.
  const { data: contract, error: contractError } = await supabase
    .from("employment_contract")
    .select(
      "contract_id, status, workspace_id, profile_id, employment_category, signing_contract_id, position_title, monthly_salary, hourly_rate, employment_percentage, start_date",
    )
    .eq("contract_id", id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const { workspace_id, profile_id } = contract;

  // ── Step 2: Guard — draft only. Idempotent if already sent. ──────────
  if (contract.signing_contract_id) {
    // Already processed — return success without side effects.
    return NextResponse.json({
      sent: true,
      status: contract.status,
      contract_id: id,
      signing_contract_id: contract.signing_contract_id,
      pii_complete: true,
    });
  }

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "Only draft contracts can be sent" }, { status: 400 });
  }

  // ── Step 3: Role gate — admin or owner only ───────────────────────────
  const { data: actorProfile } = await supabase
    .from("profile")
    .select("profile_id, role, display_name")
    .eq("user_id", user.id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!actorProfile || !["admin", "owner"].includes(actorProfile.role)) {
    return NextResponse.json({ error: "Forbidden: admin or owner role required" }, { status: 403 });
  }

  // ── SMA-311 / ADR-0309: C4 gateAction — authority enforcement ────────
  // ADR-0099 requires gate_action for mutation authority on all contract routes.
  const gateResult = await gateAction({
    workspaceId: workspace_id,
    capability: "contract",
    channel: "system",
    actorProfileId: actorProfile.profile_id,
    actionType: "send_single",
    entityId: id,
  });

  if (!gateResult.allow) {
    void emit({
      event: "gate.contract_send_denied",
      workspace_id: nonEmpty(workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: { entity_type: "employment_contract", entity_id: id },
        data: {
          contract_id: id,
          capability: "contract",
          action_type: "send_single",
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

  // Admin client — needed for auth.admin lookups and notification inserts (RLS requires service role).
  const admin = createAdminClient();

  // Resolve actor email from auth.users — used as sender_email on the contract row.
  // Fallback to "post@smartout.no" if lookup fails so the flow is never blocked.
  let senderEmail = "post@smartout.no";
  try {
    const { data: actorAuthUser } = await admin.auth.admin.getUserById(user.id);
    if (actorAuthUser.user?.email) {
      senderEmail = actorAuthUser.user.email;
    }
  } catch {
    // Non-fatal — keep fallback
  }

  // ── Step 4: Snapshot framework rules ─────────────────────────────────
  const { data: binding } = await supabase
    .from("workspace_framework_binding")
    .select("framework_id, regulatory_framework(name, version)")
    .eq("workspace_id", workspace_id)
    .eq("is_active", true)
    .single();

  if (!binding) {
    return NextResponse.json(
      { error: "No active framework binding for workspace" },
      { status: 400 },
    );
  }

  const frameworkId = binding.framework_id;
  const frameworkInfo = binding.regulatory_framework as unknown as {
    name: string;
    version: string;
  } | null;

  const { data: rules } = await supabase
    .from("framework_rule")
    .select("rule_id, rule_type, description, severity, code, category")
    .eq("framework_id", frameworkId);

  const frameworkSnapshot = {
    framework_id: frameworkId,
    framework_name: frameworkInfo?.name ?? "Unknown",
    snapshot_date: new Date().toISOString(),
    rules: (rules ?? []).map((r) => ({
      rule_id: r.rule_id,
      rule_type: r.rule_type,
      description: r.description,
      enforcement_level: r.severity,
    })),
  };

  // ── Step 5: Check PII completeness ───────────────────────────────────
  const { data: employeeProfile } = await supabase
    .from("profile")
    .select("personal_number, bank_account, address_line_1, postal_code, display_name")
    .eq("profile_id", profile_id)
    .eq("workspace_id", workspace_id)
    .single();

  if (!employeeProfile) {
    return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
  }

  const missingGroups: string[] = [];
  if (!employeeProfile.personal_number) missingGroups.push("personal_number");
  if (!employeeProfile.bank_account) missingGroups.push("bank_account");
  if (!employeeProfile.address_line_1 || !employeeProfile.postal_code)
    missingGroups.push("address");

  const allDataPresent = missingGroups.length === 0;
  const newStatus = allDataPresent ? "sent" : "pending_data";

  // ── Step 6: Resolve template ──────────────────────────────────────────
  // Prefer workspace-specific templates (is_system=false) over platform templates.
  // Null employment_category on a template matches any category (catch-all).
  const { data: template } = await supabase
    .from("contract_template")
    .select("template_id, name, content_html")
    .eq("contract_type", "employee")
    .eq("is_active", true)
    .or(`employment_category.eq.${contract.employment_category},employment_category.is.null`)
    .order("is_system", { ascending: true }) // false < true → workspace templates first
    .limit(1)
    .single();

  // A missing template is non-fatal — we proceed with empty HTML.
  const templateId = template?.template_id ?? null;
  const rawHtml = template?.content_html ?? "";

  // ── Step 7: Load company for placeholder resolution ───────────────────
  const { data: workspace } = await supabase
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", workspace_id)
    .single();

  let companyName = "Smartout";
  let companyOrgNumber = "";

  if (workspace?.company_id) {
    const { data: company } = await supabase
      .from("company")
      .select("name, org_number")
      .eq("company_id", workspace.company_id)
      .single();

    if (company) {
      companyName = company.name;
      companyOrgNumber = company.org_number ?? "";
    }
  }

  // ── Step 8: Resolve placeholders ─────────────────────────────────────
  const employeeAddress = [employeeProfile.address_line_1 ?? "", employeeProfile.postal_code ?? ""]
    .filter(Boolean)
    .join(", ");

  const placeholderValues: Partial<Record<PlaceholderKey, string>> = {
    arbeidsgiver_navn: companyName,
    arbeidsgiver_org_nr: companyOrgNumber,
    ansatt_navn: employeeProfile.display_name,
    ansatt_personnummer: employeeProfile.personal_number ?? "",
    ansatt_adresse: employeeAddress,
    stilling: contract.position_title,
    maanedslonn: contract.monthly_salary ? String(contract.monthly_salary) : "",
    timelonn: contract.hourly_rate ? String(contract.hourly_rate) : "",
    stillingsprosent: contract.employment_percentage ? String(contract.employment_percentage) : "",
    kontraktdato: new Date().toLocaleDateString("nb-NO"),
    startdato: contract.start_date ? new Date(contract.start_date).toLocaleDateString("nb-NO") : "",
  };

  const resolvedHtml = resolvePlaceholders(rawHtml, placeholderValues);

  // ── Step 9: INSERT contract row (DocuSeal signing entity) ────────────
  const { data: signingContract, error: insertError } = await supabase
    .from("contract")
    .insert({
      workspace_id,
      contract_type: "employee",
      template_id: templateId,
      resolved_html: resolvedHtml,
      resolved_values: placeholderValues as Record<string, string>,
      recipient_name: employeeProfile.display_name,
      recipient_email: "",
      sender_name: actorProfile.display_name ?? "Smartout",
      sender_email: senderEmail,
      status: "draft",
      // title is required by the schema
      title: `Arbeidsavtale – ${employeeProfile.display_name}`,
      // signatories defaults to [] in the schema but is required for Insert
      signatories: [],
    })
    .select("contract_id")
    .single();

  if (insertError || !signingContract) {
    return NextResponse.json(
      { error: `Failed to create signing contract: ${insertError?.message ?? "unknown error"}` },
      { status: 500 },
    );
  }

  const signingContractId = signingContract.contract_id;

  // ── Step 10: UPDATE employment_contract ───────────────────────────────
  const { error: updateError } = await supabase
    .from("employment_contract")
    .update({
      status: newStatus as "sent" | "pending_data",
      framework_snapshot: frameworkSnapshot,
      signing_contract_id: signingContractId,
    })
    .eq("contract_id", id);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update employment contract: ${updateError.message}` },
      { status: 500 },
    );
  }

  // ── Step 11: INSERT contract_event ────────────────────────────────────
  await supabase.from("contract_event").insert({
    contract_id: signingContractId,
    event_type: "created",
    actor_type: "admin",
    actor_id: actorProfile.profile_id,
    workspace_id,
    details: {
      employment_contract_id: id,
      status: newStatus,
      pii_complete: allDataPresent,
    },
  });

  // ── Step 11b: Notifications on successful send ───────────────────────
  // Both inserts are non-blocking — log warnings on failure, never return 500.
  // Admin client required: RLS on notification table requires service role for cross-profile writes.
  {
    const employeeTitle = allDataPresent
      ? "Du har fått en ny arbeidsavtale"
      : "Vi trenger litt info fra deg for å fullføre arbeidsavtalen";
    const employeeBody = allDataPresent
      ? `${actorProfile.display_name} har sendt deg arbeidsavtalen for ${contract.position_title}. Logg inn for å se og signere.`
      : `${actorProfile.display_name} har sendt deg en arbeidsavtale for ${contract.position_title}, men vi trenger noen opplysninger fra deg før den kan fullføres.`;

    const employeeNotifResult = await admin.from("notification").insert({
      workspace_id,
      recipient_id: profile_id,
      title: employeeTitle,
      body: employeeBody,
      action_url: "/dashboard/my-contract",
      icon_type: "info",
      metadata: {
        contract_id: id,
        signing_contract_id: signingContractId,
        type: "contract_received",
      },
    });
    if (employeeNotifResult.error) {
      console.warn(
        "[employment-contracts/send] Employee notification insert failed:",
        employeeNotifResult.error.message,
      );
    }

    const employerNotifResult = await admin.from("notification").insert({
      workspace_id,
      recipient_id: actorProfile.profile_id,
      title: "Du må signere arbeidsavtalen",
      body: `Arbeidsavtalen for ${employeeProfile.display_name} (${contract.position_title}) venter din signatur.`,
      action_url: "/dashboard/people/contracts/awaiting-my-signature",
      icon_type: "info",
      metadata: {
        contract_id: id,
        signing_contract_id: signingContractId,
        type: "employer_signature_required",
      },
    });
    if (employerNotifResult.error) {
      console.warn(
        "[employment-contracts/send] Employer notification insert failed:",
        employerNotifResult.error.message,
      );
    }
  }

  // ── Step 12: Call contract-service (if PII complete) ──────────────────
  // Non-blocking — a failure here does not abort the send flow. The contract
  // row already exists; contract-service submits it to DocuSeal for signing.
  if (allDataPresent) {
    try {
      const serviceResponse = await fetch(
        `${CONTRACT_SERVICE_URL}/contracts/${signingContractId}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Service-Key": CONTRACT_SERVICE_KEY,
          },
          body: JSON.stringify({ employment_contract_id: id }),
        },
      );

      if (!serviceResponse.ok) {
        // Log the failure as a contract_event but do not surface it as an error.
        await supabase.from("contract_event").insert({
          contract_id: signingContractId,
          event_type: "send_failed",
          actor_type: "system",
          actor_id: null,
          workspace_id,
          details: { http_status: serviceResponse.status },
        });
      }
    } catch (err) {
      // Network-level failure (contract-service unreachable in local dev, for example).
      await supabase.from("contract_event").insert({
        contract_id: signingContractId,
        event_type: "send_failed",
        actor_type: "system",
        actor_id: null,
        workspace_id,
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // ── Step 13: Create engine_state ─────────────────────────────────────
  const processName = allDataPresent ? "contract_signing" : "contract_data_intake";

  const { data: process } = await supabase
    .from("engine_process")
    .select("id")
    .eq("id", processName)
    .single();

  if (process) {
    await supabase.from("engine_state").insert({
      process_id: process.id,
      entity_type: "employment_contract",
      entity_id: id,
      workspace_id,
      status: "running",
      context: {
        profile_id,
        signing_contract_id: signingContractId,
        missing_groups: missingGroups,
      },
    });
  }

  // ── Step 14: Schedule escalation triggers (pending_data only) ─────────
  // Remind the employee at day 3, 7, and 10 if their PII is still missing.
  if (!allDataPresent && process) {
    const { data: trigger } = await supabase
      .from("engine_trigger")
      .select("id")
      .eq("process_id", process.id)
      .limit(1)
      .single();

    const { data: escalationEvent } = await supabase
      .from("engine_event")
      .select("id")
      .eq("event_name", "contract intake escalated")
      .limit(1)
      .single();

    if (trigger && escalationEvent) {
      const now = new Date();
      const escalationRows = [3, 7, 10].map((days) => {
        const fireAt = new Date(now);
        fireAt.setDate(fireAt.getDate() + days);
        return {
          trigger_id: trigger.id,
          event_id: escalationEvent.id,
          workspace_id,
          fire_at: fireAt.toISOString(),
          fired: false,
        };
      });

      await supabase.from("engine_delayed_trigger").insert(escalationRows);
    }
  }

  // ── Step 15: Emit telemetry ───────────────────────────────────────────
  void emit({
    event: "contract sent",
    workspace_id: nonEmpty(workspace_id, "workspace_id"),
    actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
    properties: {
      entity: { entity_type: "employment_contract", entity_id: id },
      data: { recipient_email: "", expires_at: "" },
    },
  });

  if (!allDataPresent) {
    void emit({
      event: "contract intake started",
      workspace_id: nonEmpty(workspace_id, "workspace_id"),
      actor_id: nonEmpty(actorProfile.profile_id, "actor_id"),
      properties: {
        entity: { entity_type: "employment_contract", entity_id: id },
        data: { contract_id: id, missing_groups: missingGroups },
      },
    });

    // ── Step 15b: Create emma_task for employee PII intake ──────────────
    // This triggers the Botsson chat to present the contract intake mission
    // to the employee on their next page load.
    await supabase.from("emma_task").insert({
      workspace_id,
      profile_id,
      title: "Fyll inn opplysninger for arbeidsavtalen din",
      description:
        "Vi trenger personnummer, bankkontonummer og adresse for å fullføre arbeidsavtalen din.",
      mission: "contract_intake",
      status: "triggered",
      context: {
        contract_id: signingContractId,
        employment_contract_id: id,
      },
    });
  }

  // ── Step 16: Return ───────────────────────────────────────────────────
  return NextResponse.json({
    sent: true,
    status: newStatus,
    contract_id: id,
    signing_contract_id: signingContractId,
    pii_complete: allDataPresent,
  });
}
