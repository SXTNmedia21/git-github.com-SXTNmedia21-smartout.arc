/**
 * fetchers.ts — settlement data fetchers for the admin app.
 *
 * All queries use RLS-scoped user clients. Service-role is only used by
 * executeSettlementRun — never in read paths here.
 *
 * Kept thin: wrap direct Supabase billing-schema queries. The billing
 * package does not export high-level settlement fetchers (only the run
 * pipeline) — these adapters fill the gap for the UI pages.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

export type SettlementRunRow = {
  run_id: string;
  scope: string;
  initiated_by: string;
  period_start: string;
  period_end: string;
  workspace_ids: string[];
  started_at: string;
  completed_at: string | null;
  status: string;
  summary: Record<string, unknown>;
  error_message: string | null;
};

export type SettlementArtifactRow = {
  artifact_id: string;
  run_id: string;
  artifact_type: string;
  storage_path: string;
  file_size_bytes: number | null;
  generated_at: string;
};

/**
 * Fetch the most recent successful settlement_run.
 * Used on the dashboard for the "Forrige periode" card.
 */
export async function fetchLastSuccessfulRun(client: AnyClient): Promise<SettlementRunRow | null> {
  const { data, error } = await client
    .schema("billing")
    .from("settlement_run")
    .select("*")
    .eq("status", "succeeded")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[avstemming/fetchers] fetchLastSuccessfulRun:", error);
    return null;
  }
  return (data as SettlementRunRow) ?? null;
}

/**
 * Fetch a single settlement_run by run_id.
 * Returns null when not found or RLS denies.
 */
export async function fetchSettlementRun(
  client: AnyClient,
  runId: string,
): Promise<SettlementRunRow | null> {
  const { data, error } = await client
    .schema("billing")
    .from("settlement_run")
    .select("*")
    .eq("run_id", runId)
    .maybeSingle();

  if (error) {
    console.error("[avstemming/fetchers] fetchSettlementRun:", error);
    return null;
  }
  return (data as SettlementRunRow) ?? null;
}

/**
 * Fetch all artifacts for a settlement run.
 */
export async function fetchSettlementArtifacts(
  client: AnyClient,
  runId: string,
): Promise<SettlementArtifactRow[]> {
  const { data, error } = await client
    .schema("billing")
    .from("settlement_artifact")
    .select("*")
    .eq("run_id", runId)
    .order("generated_at", { ascending: true });

  if (error) {
    console.error("[avstemming/fetchers] fetchSettlementArtifacts:", error);
    return [];
  }
  return (data ?? []) as SettlementArtifactRow[];
}

/**
 * Fetch settlement run history (latest 50 succeeded/failed runs).
 */
export async function fetchSettlementHistory(client: AnyClient): Promise<SettlementRunRow[]> {
  const { data, error } = await client
    .schema("billing")
    .from("settlement_run")
    .select("*")
    .in("status", ["succeeded", "failed"])
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[avstemming/fetchers] fetchSettlementHistory:", error);
    return [];
  }
  return (data ?? []) as SettlementRunRow[];
}

/**
 * Count orders pending "mottatt betalt" marking (status in issued/sent/overdue).
 * Used by the QuickTasks component on the dashboard.
 */
export async function countPendingOrders(client: AnyClient, companyIds: string[]): Promise<number> {
  if (companyIds.length === 0) return 0;
  const { count, error } = await client
    .from("invoice")
    .select("invoice_id", { count: "exact", head: true })
    .in("company_id", companyIds)
    .in("status", ["issued", "sent", "overdue"]);

  if (error) {
    console.error("[avstemming/fetchers] countPendingOrders:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Compute a lightweight period preview for the dashboard CTA.
 * Returns total workspaces count, order count, and sum from billing.compute_period_aggregates.
 * Falls back to zeros on RPC failure (RPC may not exist yet on local dev).
 */
export type PeriodPreview = {
  workspace_count: number;
  order_count: number;
  total_nok_incl_vat: number;
};

export async function fetchPeriodPreview(
  client: AnyClient,
  workspaceIds: string[],
  periodStart: string,
  periodEnd: string,
): Promise<PeriodPreview> {
  if (workspaceIds.length === 0) {
    return { workspace_count: 0, order_count: 0, total_nok_incl_vat: 0 };
  }

  const { data, error } = await client.schema("billing").rpc("compute_period_aggregates", {
    p_workspace_ids: workspaceIds,
    p_period_start: periodStart,
    p_period_end: periodEnd,
  });

  if (error || !data) {
    // RPC may not be available in all dev environments — degrade gracefully.
    console.warn("[avstemming/fetchers] fetchPeriodPreview RPC unavailable:", error?.message);
    return {
      workspace_count: workspaceIds.length,
      order_count: 0,
      total_nok_incl_vat: 0,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary = data as any;
  const totals = summary?.totals ?? {};
  const byWorkspace = summary?.by_workspace ?? {};

  const order_count = Object.values(byWorkspace).reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sum: number, ws: any) => sum + (ws?.count_orders ?? 0),
    0,
  );

  return {
    workspace_count: workspaceIds.length,
    order_count,
    total_nok_incl_vat: totals?.amount_incl_vat ?? 0,
  };
}
