// packages/ai/src/capabilities/contract/tools.ts
//
// Botsson contract tools — let Botsson list templates, inspect contract status,
// create draft contracts, and trigger sending for signature. Admin-gated mutations
// are checked against the actor's workspace role before proceeding.
import { z } from "zod";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext, SessionChannel } from "../types.js";
import { callGateAction } from "./gate.js";

const normaliseChannel = (c: SessionChannel | undefined): SessionChannel => c ?? "system";

/**
 * Helper — runs C4 authority gate (ADR-0099) for a contract mutation.
 * Returns null on allow, or a string error to return to the caller on deny.
 * Caller must guard for missing workspaceId/profileId before invoking.
 */
async function gateMutation(
  ctx: AgentToolContext,
  actionType: string,
  entityId?: string,
): Promise<string | null> {
  if (!ctx.workspaceId || !ctx.profileId) {
    return "Error: missing workspaceId or profileId (ADR-0134).";
  }
  const gate = await callGateAction(ctx.supabaseAdmin, ctx.workspaceId, ctx.profileId, {
    capability: "contract",
    channel: normaliseChannel(ctx.channel),
    actionType,
    entityId,
  });
  if (!gate.allow) {
    return JSON.stringify({
      error: "gate_denied",
      reason: gate.reason ?? "denied",
      adr: "ADR-0099",
    });
  }
  return null;
}

// ── Read-only tools ──────────────────────────────────────────────────────────

export const listEmployeeTemplates = defineTool({
  name: "list_employee_templates",
  description:
    "List active employee contract templates available in this workspace (including platform-level templates).",
  capability: "contract",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Templates are either workspace-specific or platform-level (null workspace_id)
    const { data, error } = await supabase
      .from("contract_template")
      .select("template_id, name, description, created_at")
      .eq("contract_type", "employee")
      .eq("is_active", true)
      .or(`workspace_id.eq.${ctx.workspaceId},workspace_id.is.null`)
      .order("created_at", { ascending: false });

    if (error) return `Error loading templates: ${error.message}`;
    if (!data || data.length === 0) return "No active employee contract templates found.";
    return JSON.stringify(data);
  },
});

export const listEmployeeContracts = defineTool({
  name: "list_employee_contracts",
  description: "List employee contracts in this workspace, optionally filtered by status.",
  capability: "contract",
  schema: z.object({
    status: z
      .enum(["draft", "sent", "viewed", "signed", "expired"])
      .optional()
      .describe("Filter contracts by status. If omitted, returns all statuses."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    let query = supabase
      .from("contract")
      .select(
        "contract_id, status, created_at, sent_at, signed_at, recipient_name, template:template_id(name)",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("contract_type", "employee")
      .order("created_at", { ascending: false })
      .limit(50);

    if (params.status) query = query.eq("status", params.status);

    const { data, error } = await query;
    if (error) return `Error loading contracts: ${error.message}`;
    if (!data || data.length === 0) return "No employee contracts found.";
    return JSON.stringify(data);
  },
});

export const checkContractStatus = defineTool({
  name: "check_contract_status",
  description: "Check the current status and details of a specific contract by ID.",
  capability: "contract",
  schema: z.object({
    contract_id: z.string().uuid().describe("The contract ID to look up"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("contract")
      .select(
        "contract_id, status, created_at, sent_at, signed_at, expires_at, recipient_name, template:template_id(name)",
      )
      .eq("contract_id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error) return `Error loading contract: ${error.message}`;
    if (!data) return "Contract not found in this workspace.";
    return JSON.stringify(data);
  },
});

export const explainContractClause = defineTool({
  name: "explain_contract_clause",
  description:
    "Explain a specific clause from a contract's regulatory framework snapshot. Returns the rule verbatim — read-only, no interpretation.",
  capability: "contract",
  schema: z.object({
    contract_id: z.string().uuid().describe("The contract ID to look up"),
    clause_index: z
      .number()
      .int()
      .min(0)
      .describe("Zero-based index of the rule in the snapshot's rules array"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("employment_contract")
      .select("framework_snapshot")
      .eq("contract_id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error) return `Error loading contract: ${error.message}`;
    if (!data) return "Contract not found in this workspace.";

    const snapshot = data.framework_snapshot as { rules?: unknown[] } | null;
    if (!snapshot || !Array.isArray(snapshot.rules)) {
      return "This contract has no framework snapshot or no rules array.";
    }

    if (params.clause_index >= snapshot.rules.length) {
      return `Index ${params.clause_index} is out of range. The snapshot has ${snapshot.rules.length} rule(s) (0–${snapshot.rules.length - 1}).`;
    }

    const rule = snapshot.rules[params.clause_index] as Record<string, unknown>;
    return JSON.stringify({
      rule_id: rule.rule_id,
      rule_type: rule.rule_type,
      enforcement_level: rule.enforcement_level,
      description: rule.description,
      parameters: rule.parameters,
    });
  },
});

export const getComplianceDriftForContract = defineTool({
  name: "get_compliance_drift_for_contract",
  description:
    "Check whether a contract has compliance drift — differences between the contract's snapshot and the current framework. Read-only.",
  capability: "contract",
  schema: z.object({
    contract_id: z.string().uuid().describe("The contract ID to check for drift"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("compliance_drift")
      .select("*")
      .eq("contract_id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId);

    if (error) return `Error querying compliance drift: ${error.message}`;
    if (!data || data.length === 0) {
      return JSON.stringify({
        has_drift: false,
        drift_count: 0,
        message: "No compliance drift detected for this contract.",
      });
    }

    return JSON.stringify({
      has_drift: true,
      drift_count: data.length,
      drifts: data,
    });
  },
});

// ── Admin-gated mutation tools ───────────────────────────────────────────────

/**
 * Resolve the caller's role in this workspace so admin-only tools can guard access.
 * Returns the role string or null if the profile is not found.
 */
async function resolveActorRole(
  ctx: AgentToolContext,
): Promise<"employee" | "manager" | "admin" | "owner" | null> {
  const { data } = await ctx.supabaseAdmin
    .from("profile")
    .select("role")
    .eq("profile_id", ctx.profileId)
    .eq("workspace_id", ctx.workspaceId)
    .single();

  return (data?.role as "employee" | "manager" | "admin" | "owner" | null) ?? null;
}

export const createEmployeeContract = defineTool({
  name: "create_employee_contract",
  description:
    "Create a draft employee contract from a template for a given employee. Admin or owner only.",
  capability: "contract",
  schema: z.object({
    template_id: z.string().uuid().describe("The contract template ID to use"),
    profile_id: z.string().uuid().describe("The profile ID of the employee to contract"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0099 / ADR-0186 mandatory C4 gate — fail-closed before any work.
    const denied = await gateMutation(ctx, "create_employee_contract", params.profile_id);
    if (denied) return denied;

    // Defence-in-depth: keep the role check on top of the gate (different layer).
    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: creating contracts requires admin or owner role.";
    }

    const serviceUrl = process.env.CONTRACT_SERVICE_URL;
    const serviceKey = process.env.CONTRACT_SERVICE_KEY;

    if (!serviceUrl || !serviceKey) {
      return "Contract service is not configured (missing CONTRACT_SERVICE_URL or CONTRACT_SERVICE_KEY).";
    }

    // Build placeholder map and fetch the recipient email in parallel —
    // both are needed before the contract service call.
    const [placeholders, profileResult] = await Promise.all([
      buildEmployeePlaceholderMap(ctx.supabaseAdmin, params.profile_id, ctx.workspaceId),
      ctx.supabaseAdmin
        .from("profile")
        .select("user_identity:user_id(email)")
        .eq("profile_id", params.profile_id)
        .single(),
    ]);

    // Supabase FK joins may return as array — normalise to a plain object.
    const userIdentityRaw = profileResult.data?.user_identity;
    const userIdentity = (Array.isArray(userIdentityRaw) ? userIdentityRaw[0] : userIdentityRaw) as
      | { email: string }
      | null
      | undefined;
    const recipientEmail = userIdentity?.email ?? "";

    const createController = new AbortController();
    const createTimeout = setTimeout(() => createController.abort(), 10000);

    try {
      const response = await fetch(`${serviceUrl}/contracts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": serviceKey,
        },
        body: JSON.stringify({
          workspace_id: ctx.workspaceId,
          template_id: params.template_id,
          profile_id: params.profile_id,
          placeholders,
          created_by: ctx.profileId,
        }),
        signal: createController.signal,
      });
      clearTimeout(createTimeout);

      if (!response.ok) {
        const text = await response.text();
        return `Contract service error (${response.status}): ${text}`;
      }

      const result = (await response.json()) as { contract_id: string; status: string };

      // Fire through the central emit() so all four destinations are covered:
      // activity_trail, PostHog, logger, and engine_event (where routed).
      void emit({
        event: "contract created",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "contract" as const, entity_id: result.contract_id },
          data: {
            template_id: params.template_id,
            recipient_email: recipientEmail,
            contract_type: "employee",
          },
        },
      });

      return JSON.stringify({
        created: true,
        contract_id: result.contract_id,
        status: result.status,
      });
    } catch (err) {
      clearTimeout(createTimeout);
      if (err instanceof Error && err.name === "AbortError") {
        return "Contract service timed out after 10 seconds.";
      }
      throw err;
    }
  },
});

export const sendEmployeeContract = defineTool({
  name: "send_employee_contract",
  description:
    "Send a draft contract for employee signing. IRREVERSIBLE — once sent, it cannot be recalled. Admin or owner only.",
  capability: "contract",
  schema: z.object({
    contract_id: z.string().uuid().describe("The draft contract ID to send for signing"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0099 / ADR-0186 mandatory C4 gate — sendEmployeeContract is
    // IRREVERSIBLE; gate first, then defence-in-depth role check.
    const denied = await gateMutation(ctx, "send_employee_contract", params.contract_id);
    if (denied) return denied;

    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: sending contracts requires admin or owner role.";
    }

    // Verify the contract is in draft state and is an employee contract before sending — this action is irreversible
    // Also fetch recipient_email for the ADR-0004 emit after successful send.
    const { data: contract, error: lookupError } = await ctx.supabaseAdmin
      .from("contract")
      .select("contract_id, status, contract_type, recipient_email")
      .eq("contract_id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (lookupError) return `Error looking up contract: ${lookupError.message}`;
    if (!contract) return "Contract not found in this workspace.";

    // Guard: this tool only handles employee contracts
    if (contract.contract_type !== "employee") {
      return "This tool can only send employee contracts.";
    }

    if (contract.status !== "draft") {
      return `Cannot send contract — current status is '${contract.status}'. Only draft contracts can be sent.`;
    }

    const serviceUrl = process.env.CONTRACT_SERVICE_URL;
    const serviceKey = process.env.CONTRACT_SERVICE_KEY;

    if (!serviceUrl || !serviceKey) {
      return "Contract service is not configured (missing CONTRACT_SERVICE_URL or CONTRACT_SERVICE_KEY).";
    }

    const sendController = new AbortController();
    const sendTimeout = setTimeout(() => sendController.abort(), 10000);

    try {
      const response = await fetch(`${serviceUrl}/contracts/${params.contract_id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Key": serviceKey,
        },
        body: JSON.stringify({ sent_by: ctx.profileId }),
        signal: sendController.signal,
      });
      clearTimeout(sendTimeout);

      if (!response.ok) {
        const text = await response.text();
        return `Contract service error (${response.status}): ${text}`;
      }

      // Fire through the central emit() so all four destinations are covered:
      // activity_trail, PostHog, logger, and engine_event (where routed).
      // workspace_id + actor_id from server-derived context (ADR-0151 + L-0177 — never from body).
      // expires_at mirrors contract-service formula: sent_at + 14 days.
      const sentAt = new Date();
      void emit({
        event: "contract sent",
        workspace_id: ctx.workspaceId,
        actor_id: ctx.profileId,
        properties: {
          entity: { entity_type: "contract" as const, entity_id: params.contract_id },
          data: {
            recipient_email: contract.recipient_email ?? "",
            expires_at: new Date(sentAt.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      });

      return JSON.stringify({ sent: true, contract_id: params.contract_id });
    } catch (err) {
      clearTimeout(sendTimeout);
      if (err instanceof Error && err.name === "AbortError") {
        return "Contract service timed out after 10 seconds.";
      }
      throw err;
    }
  },
});

// ─── Contract Hub Redesign — Gate G4 tools (Council 2026-04-22) ──────────────
//
// Three new chat-only, suggest-level tools that implement the K1a→K1b fork
// lifecycle on `contract_template` introduced in Gate G5 (lineage + lifecycle
// columns: source_template_id, source_template_version, forked_at,
// published_at, deprecated_at).
//
// All three share the contract capability's `allowedChannels: ["chat"]`
// constraint (authoring over voice is forbidden — ADR-0078). Each tool
// redundantly asserts ctx.channel === "chat" as defence-in-depth.
//
// Mobile boundary (ADR-0133): these tools are authoring surfaces and
// therefore MUST NOT appear in any mobile capability exposure. The contract
// capability today has a single config file exposed to both surfaces, but
// the channel guard (chat-only) already excludes voice flows. If a mobile
// capability split lands later, these three tools stay web-only.
//
// Telemetry (G2 registry): fork → "contract_template forked",
// publish → "contract_template published", deprecate → "contract_template
// deprecated". All three route to all four destinations (posthog, logger,
// activity_trail, engine_event).
//
// Authority (Gate G4 migration): the `contract` capability is seeded into
// engine_authority_config with level='confirm', min_role='admin'. The
// `gate_action` pipeline denies invocation if no row exists (L-0066 CVE).
//
// Contracts created against workspace templates survive deprecation —
// deprecation is a soft-retire marker, not a delete. Historical lineage is
// preserved so signed contracts always resolve to a source template.

export const forkTemplate = defineTool({
  name: "fork_template",
  description:
    "Clone a system (K1a) contract template into the workspace so it can be customised. Creates a workspace-owned draft (is_system=false) with full lineage to the source. Admin or owner only; chat channel only.",
  capability: "contract",
  schema: z.object({
    system_template_id: z.string().uuid().describe("The platform/system contract_template to fork"),
    name_override: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        "Optional name for the workspace copy. If omitted, the server appends ' (kopi)' to the source name.",
      ),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // ADR-0078 layer 3: chat-only for template authoring
    if (ctx.channel && ctx.channel !== "chat") {
      return "Template authoring requires chat channel. Please switch to chat.";
    }

    // ADR-0099 / ADR-0186 mandatory C4 gate.
    const denied = await gateMutation(ctx, "fork_template", params.system_template_id);
    if (denied) return denied;

    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: forking templates requires admin or owner role.";
    }

    // ── Fix #2 (ADR-0191) — direct admin write ────────────────────────────
    // Previously this tool fetched `${APP_URL}/api/contract-templates/copy`
    // with no auth header. That route guards on `supabase.auth.getUser()`,
    // which requires a session cookie — stage-engine has no cookie context,
    // so the call returned 401 every time. The fix mirrors the sibling
    // `publishWorkspaceTemplate` / `deprecateWorkspaceTemplate` pattern:
    // write directly via `ctx.supabaseAdmin`, with the role gate enforced
    // above and `gate_action` enforced upstream by the agent dispatcher
    // (ADR-0099). This also makes the tool the canonical emit site for the
    // agent fork path — the route stays canonical for the UI path (Fix #3).

    // Load source to capture version + default name + full row to clone.
    // Belt-and-suspenders is_system=true assertion; Gate G3 trigger blocks
    // any later flip, but a precise pre-check yields a clearer error than
    // RLS-empty.
    const { data: source, error: sourceError } = await ctx.supabaseAdmin
      .from("contract_template")
      .select("*")
      .eq("template_id", params.system_template_id)
      .eq("is_system", true)
      .single();

    if (sourceError) return `Error loading source template: ${sourceError.message}`;
    if (!source) return "System template not found.";

    // Lineage stamp — atomic with the INSERT so partial-forks never exist.
    // `source.version` is numeric on the column; lineage column is text to
    // accommodate future semver, so stringify here (matches route behaviour).
    const forkedAt = new Date().toISOString();
    const sourceVersion = source.version !== null ? String(source.version) : null;
    const resolvedName = params.name_override ?? `${source.name} (kopi)`;

    const { data: copy, error: copyError } = await ctx.supabaseAdmin
      .from("contract_template")
      .insert({
        name: resolvedName,
        description: source.description,
        workspace_id: ctx.workspaceId,
        contract_type: source.contract_type,
        language: source.language,
        content_html: source.content_html,
        content_css: source.content_css,
        header_html: source.header_html,
        footer_html: source.footer_html,
        placeholders: source.placeholders,
        employment_category: source.employment_category,
        is_system: false,
        is_active: true,
        version: 1,
        // ── Gate G5 lineage columns ──
        source_template_id: params.system_template_id,
        source_template_version: sourceVersion,
        forked_at: forkedAt,
        // Explicitly null for a fresh fork — caller can publish later.
        published_at: null,
        deprecated_at: null,
      })
      .select("template_id, source_template_version, forked_at")
      .single();

    if (copyError) return `Fork failed: ${copyError.message}`;
    if (!copy) return "Fork failed: insert returned no row.";

    // Canonical emit for the agent path. The route emits its own
    // `contract_template forked` for the UI path (Fix #3 — each path emits
    // exactly once). The legacy `contract_template copied` event is being
    // phased out (see route).
    void emit({
      event: "contract_template forked",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "contract_template", entity_id: copy.template_id },
        data: {
          source_template_id: params.system_template_id,
          source_scope: "system",
          name: resolvedName,
        },
      },
    });

    return JSON.stringify({
      workspace_template_id: copy.template_id,
      source_version: copy.source_template_version ?? sourceVersion ?? "",
      forked_at: copy.forked_at ?? forkedAt,
    });
  },
});

export const publishWorkspaceTemplate = defineTool({
  name: "publish_workspace_template",
  description:
    "Publish (or re-activate) a workspace contract template so it becomes eligible for binding. Clears `deprecated_at` when present so a retired template can be brought back into service. Admin or owner only; chat channel only.",
  capability: "contract",
  schema: z.object({
    workspace_template_id: z.string().uuid().describe("The workspace template to publish"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    if (ctx.channel && ctx.channel !== "chat") {
      return "Template authoring requires chat channel. Please switch to chat.";
    }

    // ADR-0099 / ADR-0186 mandatory C4 gate.
    const denied = await gateMutation(
      ctx,
      "publish_workspace_template",
      params.workspace_template_id,
    );
    if (denied) return denied;

    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: publishing templates requires admin or owner role.";
    }

    // Load the template to verify ownership + scope. Admin RLS restricts
    // UPDATE to is_system=false rows in the caller's workspace, but we
    // pre-check for a precise error message (otherwise RLS returns empty
    // data which is confusing for the LLM).
    const { data: tpl, error: loadError } = await ctx.supabaseAdmin
      .from("contract_template")
      .select("template_id, workspace_id, is_system, published_at, deprecated_at, name, version")
      .eq("template_id", params.workspace_template_id)
      .single();

    if (loadError) return `Error loading template: ${loadError.message}`;
    if (!tpl) return "Template not found.";
    if (tpl.is_system === true) {
      return "Cannot publish a system template from a workspace context.";
    }
    if (tpl.workspace_id !== ctx.workspaceId) {
      return "Template belongs to a different workspace.";
    }

    const isReactivation = tpl.deprecated_at !== null;
    const nowIso = new Date().toISOString();

    // Journey 5 (re-activate): a template may be currently deprecated.
    // Publishing it clears `deprecated_at` AND sets `published_at` (or
    // preserves an earlier publish if one exists — semantics: becoming
    // bindable again). We always stamp published_at to `now()` so the
    // "most recent activation" is explicit in the audit trail.
    const { data: updated, error: updateError } = await ctx.supabaseAdmin
      .from("contract_template")
      .update({
        published_at: nowIso,
        deprecated_at: null,
      })
      .eq("template_id", params.workspace_template_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_system", false)
      .select("template_id, published_at, version")
      .single();

    if (updateError) return `Publish failed: ${updateError.message}`;
    if (!updated) return "Publish failed: template not updated (RLS or missing row).";

    void emit({
      event: "contract_template published",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "contract_template", entity_id: updated.template_id },
        data: {
          name: tpl.name,
          published_at: updated.published_at ?? nowIso,
          is_reactivation: isReactivation,
        },
      },
    });

    return JSON.stringify({
      template_id: updated.template_id,
      published_at: updated.published_at ?? nowIso,
      version: updated.version ?? 1,
    });
  },
});

export const deprecateWorkspaceTemplate = defineTool({
  name: "deprecate_workspace_template",
  description:
    "Soft-retire a workspace contract template so it is no longer offered for new bindings. Existing contracts continue to reference it; `published_at` is preserved so the audit trail stays intact. Cannot be used on drafts (templates with no `published_at`) — delete those instead. Admin or owner only; chat channel only.",
  capability: "contract",
  schema: z.object({
    workspace_template_id: z.string().uuid().describe("The workspace template to deprecate"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    if (ctx.channel && ctx.channel !== "chat") {
      return "Template authoring requires chat channel. Please switch to chat.";
    }

    // ADR-0099 / ADR-0186 mandatory C4 gate.
    const denied = await gateMutation(
      ctx,
      "deprecate_workspace_template",
      params.workspace_template_id,
    );
    if (denied) return denied;

    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: deprecating templates requires admin or owner role.";
    }

    const { data: tpl, error: loadError } = await ctx.supabaseAdmin
      .from("contract_template")
      .select("template_id, workspace_id, is_system, published_at, deprecated_at, name")
      .eq("template_id", params.workspace_template_id)
      .single();

    if (loadError) return `Error loading template: ${loadError.message}`;
    if (!tpl) return "Template not found.";
    if (tpl.is_system === true) {
      return "Cannot deprecate a system template from a workspace context.";
    }
    if (tpl.workspace_id !== ctx.workspaceId) {
      return "Template belongs to a different workspace.";
    }

    // Guard: drafts cannot be deprecated — they are deleted outright.
    // The deprecated_at marker is meaningful only for published templates,
    // where it expresses "was active, now retired".
    if (tpl.published_at === null) {
      return "Cannot deprecate a draft template. Delete it instead.";
    }

    // Idempotency: if already deprecated, short-circuit with the existing
    // timestamp so repeated tool calls produce stable output and do not
    // emit a second event.
    if (tpl.deprecated_at !== null) {
      return JSON.stringify({
        template_id: tpl.template_id,
        deprecated_at: tpl.deprecated_at,
        already_deprecated: true,
      });
    }

    const nowIso = new Date().toISOString();

    const { data: updated, error: updateError } = await ctx.supabaseAdmin
      .from("contract_template")
      .update({ deprecated_at: nowIso })
      .eq("template_id", params.workspace_template_id)
      .eq("workspace_id", ctx.workspaceId)
      .eq("is_system", false)
      .select("template_id, deprecated_at")
      .single();

    if (updateError) return `Deprecate failed: ${updateError.message}`;
    if (!updated) return "Deprecate failed: template not updated (RLS or missing row).";

    void emit({
      event: "contract_template deprecated",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      properties: {
        entity: { entity_type: "contract_template", entity_id: updated.template_id },
        data: {
          name: tpl.name,
          deprecated_at: updated.deprecated_at ?? nowIso,
          replacement_template_id: null,
        },
      },
    });

    return JSON.stringify({
      template_id: updated.template_id,
      deprecated_at: updated.deprecated_at ?? nowIso,
    });
  },
});
