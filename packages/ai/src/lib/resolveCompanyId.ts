// Resolves the company_id for the active agent workspace.
//
// Billing (ADR-0118) is company-scoped, but every agent tool operates
// in a workspace context (AgentToolContext.workspaceId). Billing tools
// in @smartout/ai/tools/billing (to be added when agent surface
// lands) call this helper before touching any billing table so the
// agent can't accidentally leak cross-company data even when the
// service-role admin client bypasses RLS.
//
// Throws if the workspace isn't linked to a company — loud is better
// than silent cross-tenant leak.

import type { AgentToolContext } from "../capabilities/types";

export async function resolveCompanyId(ctx: AgentToolContext): Promise<string> {
  const { data, error } = await ctx.supabaseAdmin
    .from("workspace")
    .select("company_id")
    .eq("workspace_id", ctx.workspaceId)
    .single();

  if (error) {
    throw new Error(
      `resolveCompanyId: failed to read workspace ${ctx.workspaceId}: ${error.message}`,
    );
  }

  if (!data?.company_id) {
    throw new Error(`resolveCompanyId: workspace ${ctx.workspaceId} is not linked to a company`);
  }

  return data.company_id;
}
