// packages/ai/src/capabilities/contract/tools.ts
//
// Botsson contract tools — let Botsson list templates, inspect contract status,
// create draft contracts, and trigger sending for signature. Admin-gated mutations
// are checked against the actor's workspace role before proceeding.
import { z } from "zod";
import { buildEmployeePlaceholderMap } from "@smartout/utils";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

// ── Read-only tools ──────────────────────────────────────────────────────────

export const listEmployeeTemplates = defineTool({
  name: "list_employee_templates",
  description:
    "List active employee contract templates available in this workspace (including platform-level templates).",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Templates are either workspace-specific or platform-level (null workspace_id)
    const { data, error } = await supabase
      .from("contract_template")
      .select("id, name, description, created_at")
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
        "id, status, created_at, sent_at, signed_at, profile:profile_id(display_name), template:contract_template_id(name)",
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
  schema: z.object({
    contract_id: z.string().uuid().describe("The contract ID to look up"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("contract")
      .select(
        "id, status, created_at, sent_at, signed_at, expires_at, profile:profile_id(display_name), template:contract_template_id(name)",
      )
      .eq("id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (error) return `Error loading contract: ${error.message}`;
    if (!data) return "Contract not found in this workspace.";
    return JSON.stringify(data);
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

    // Build placeholder map from the employee's profile + employment data
    const placeholders = await buildEmployeePlaceholderMap(
      ctx.supabaseAdmin,
      params.profile_id,
      ctx.workspaceId,
    );

    const response = await fetch(`${serviceUrl}/contracts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        workspace_id: ctx.workspaceId,
        template_id: params.template_id,
        profile_id: params.profile_id,
        placeholders,
        created_by: ctx.profileId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return `Contract service error (${response.status}): ${text}`;
    }

    const result = (await response.json()) as { id: string; status: string };
    return JSON.stringify({ created: true, contract_id: result.id, status: result.status });
  },
});

export const sendEmployeeContract = defineTool({
  name: "send_employee_contract",
  description:
    "Send a draft contract for employee signing. IRREVERSIBLE — once sent, it cannot be recalled. Admin or owner only.",
  schema: z.object({
    contract_id: z.string().uuid().describe("The draft contract ID to send for signing"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    // Guard: only admins and owners may send contracts
    const role = await resolveActorRole(ctx);
    if (role !== "admin" && role !== "owner") {
      return "Access denied: sending contracts requires admin or owner role.";
    }

    // Verify the contract is in draft state before sending — this action is irreversible
    const { data: contract, error: lookupError } = await ctx.supabaseAdmin
      .from("contract")
      .select("id, status")
      .eq("id", params.contract_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (lookupError) return `Error looking up contract: ${lookupError.message}`;
    if (!contract) return "Contract not found in this workspace.";
    if (contract.status !== "draft") {
      return `Cannot send contract — current status is '${contract.status}'. Only draft contracts can be sent.`;
    }

    const serviceUrl = process.env.CONTRACT_SERVICE_URL;
    const serviceKey = process.env.CONTRACT_SERVICE_KEY;

    if (!serviceUrl || !serviceKey) {
      return "Contract service is not configured (missing CONTRACT_SERVICE_URL or CONTRACT_SERVICE_KEY).";
    }

    const response = await fetch(`${serviceUrl}/contracts/${params.contract_id}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ sent_by: ctx.profileId }),
    });

    if (!response.ok) {
      const text = await response.text();
      return `Contract service error (${response.status}): ${text}`;
    }

    return JSON.stringify({ sent: true, contract_id: params.contract_id });
  },
});
