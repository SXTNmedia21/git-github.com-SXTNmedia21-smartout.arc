/**
 * fetchers.ts — kartotek fetcher stubs
 *
 * Stub — implemented in M3.
 * Will wrap @smartout/billing/server/kartotek (fetchWorkspaceKartotek).
 * Returns null until M3 connects real queries.
 */

export type WorkspaceKartotekSummary = {
  workspace_id: string;
  company_id: string;
  workspace_name: string;
  workspace_slug: string;
  company_name: string;
  company_org_number: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  company_created_at: string;
  invoice_count_total: number;
  invoice_count_outstanding: number;
  amount_outstanding_incl_vat: number;
  last_invoice_at: string | null;
  last_paid_at: string | null;
  member_count: number;
};

/**
 * Fetches workspace kartotek summary from v_workspace_kartotek_summary view.
 * TODO M3: replace with @smartout/billing/server fetchWorkspaceKartotek
 */
export async function fetchWorkspaceKartotek(
  _workspaceId: string,
): Promise<WorkspaceKartotekSummary | null> {
  return null;
}
