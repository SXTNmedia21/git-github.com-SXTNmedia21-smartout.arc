// packages/ai/src/capabilities/contract/tools.ts
//
// Botsson contract tools — let Botsson list templates, inspect contract status,
// create draft contracts, and trigger sending for signature. Admin-gated mutations
// are checked against the actor's workspace role before proceeding.
import { z } from "zod";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

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
    // Guard: only admins and owners may create contracts
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
    // Guard: only admins and owners may send contracts
    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: sending contracts requires admin or owner role.";
    }

    // Verify the contract is in draft state and is an employee contract before sending — this action is irreversible
    const { data: contract, error: lookupError } = await ctx.supabaseAdmin
      .from("contract")
      .select("contract_id, status, contract_type")
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
