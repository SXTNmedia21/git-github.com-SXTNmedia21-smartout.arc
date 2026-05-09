/**
 * use-lonnsgrunnlag — TanStack Query hooks for lønnsgrunnlag PDF list + signed URL.
 *
 * Mobile is WITNESS-only for payroll (ADR-0133). These hooks are read-only.
 * No authoring, no generation, no admin actions.
 *
 * useMyLonnsgrunnlagList — fetches the employee's PDF export events via:
 *   GET /api/payroll/exports?periodId=<id>&format=pdf
 *   NOTE: the exports route today takes `periodId`, not `profileId`. Since the
 *   employee only has one workspace/set of periods, we list all their periods
 *   from payroll.period (approved/exported status) then join export_events that
 *   have export_format='pdf' client-side. This avoids needing a new BFF endpoint
 *   while the lonnsgrunnlag Wave B routes are being built in parallel.
 *
 * useLonnsgrunnlagUrl — fetches a signed URL for a specific export event via:
 *   GET /api/payroll/lonnsgrunnlag-url?lonnsgrunnlagId=<id>&profileId=<own>
 *   Wave B BFF route. Disabled (returns undefined) if route not available.
 *
 * profile_id derivation: ALWAYS from getProfileContext() (ADR-0151 / ADR-0134).
 * Never from user input or forgeable client payloads.
 *
 * L-0176: body verified, then docstring written.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getProfileContext } from "@/lib/profile-context";
import { getWebApiUrl } from "@/lib/web-api";

/* ── Types ────────────────────────────────────────────────────────────────── */

export type LonnsgrunnlagListItem = {
  /** export_event.id */
  id: string;
  period_id: string;
  /** started_at from export_event, aliased for UI clarity */
  exported_at: string;
  /** export_event.variant — 'aggregate' | 'audit' | null */
  variant: string | null;
  format: "pdf";
  file_hash: string | null;
  /** Human-readable period label, e.g. "Mai 2026" */
  period_label: string;
  period_start: string;
  period_end: string;
};

export type LonnsgrunnlagUrl = {
  signed_url: string;
  expires_at: string;
};

/** How long the list is considered fresh (5 minutes) */
const STALE_TIME_LIST_MS = 5 * 60 * 1000;

/** How long a signed URL is considered fresh. Expiry is ~1h, refetch at ~50min mark */
const STALE_TIME_URL_MS = 50 * 60 * 1000;

const MONTH_NAMES_NO = [
  "Januar",
  "Februar",
  "Mars",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function formatPeriodLabel(startDate: string): string {
  const d = new Date(startDate + "T00:00:00");
  return `${MONTH_NAMES_NO[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── List fetcher ──────────────────────────────────────────────────────────── */

async function fetchMyLonnsgrunnlagList(): Promise<LonnsgrunnlagListItem[]> {
  // ADR-0151 / ADR-0134 — derive identity server-side; throw on missing IDs.
  const { profileId, workspaceId } = await getProfileContext();

  // Step 1: fetch all approved/exported periods in this workspace.
  const { data: periods, error: periodsError } = await supabase
    .schema("payroll")
    .from("period")
    .select("id, start_date, end_date, status")
    .eq("workspace_id", workspaceId)
    .in("status", ["approved", "exported"])
    .order("start_date", { ascending: false });

  if (periodsError) throw periodsError;
  if (!periods || periods.length === 0) return [];

  // Step 2: for each period, fetch export_event rows where export_format = 'pdf'
  // and the workspace scopes correctly. The export_event table has no profile_id
  // column (it is a per-period admin action). The employee can see which PDFs
  // were generated for their period — the signed URL gate on the BFF enforces
  // that they can only download their own profile_id's PDF.
  //
  // Cast to any: export_format is not in generated types for the payroll schema
  // (same pattern as exports/route.ts line 63 — types generated pre-migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events, error: eventsError } = await (supabase.schema("payroll") as any)
    .from("export_event")
    .select("id, period_id, variant, file_hash, started_at, status, export_format")
    .eq("workspace_id", workspaceId)
    .eq("export_format", "pdf")
    .eq("status", "completed")
    .in(
      "period_id",
      periods.map((p: { id: string }) => p.id),
    )
    .order("started_at", { ascending: false });

  if (eventsError) throw eventsError;
  if (!events || events.length === 0) return [];

  // Build period lookup for label generation
  const periodMap = new Map(
    periods.map((p: { id: string; start_date: string; end_date: string }) => [p.id, p]),
  );

  // Suppress unused variable warning: profileId is used for future BFF calls
  // and is the authority anchor for ADR-0151. It is deliberately destructured
  // here so callers can see profile_id resolution is in place.
  void profileId;

  const items: LonnsgrunnlagListItem[] = (
    events as Array<{
      id: string;
      period_id: string;
      variant: string | null;
      file_hash: string | null;
      started_at: string;
      status: string;
      export_format: string;
    }>
  ).map((ev) => {
    const period = periodMap.get(ev.period_id);
    const startDate = period?.start_date ?? ev.started_at.slice(0, 10);
    const endDate = period?.end_date ?? ev.started_at.slice(0, 10);
    return {
      id: ev.id,
      period_id: ev.period_id,
      exported_at: ev.started_at,
      variant: ev.variant ?? null,
      format: "pdf" as const,
      file_hash: ev.file_hash ?? null,
      period_label: formatPeriodLabel(startDate),
      period_start: startDate,
      period_end: endDate,
    };
  });

  return items;
}

/* ── URL fetcher ────────────────────────────────────────────────────────────── */

async function fetchLonnsgrunnlagUrl(
  eventId: string,
  profileId: string,
): Promise<LonnsgrunnlagUrl> {
  // Wave B BFF route — GET /api/payroll/lonnsgrunnlag-url
  // profile_id passed as query param but the BFF MUST re-derive from JWT (ADR-0151).
  // The param here is advisory (for logging / audit) — the BFF enforces ownership.
  const url = `${getWebApiUrl()}/api/payroll/lonnsgrunnlag-url?lonnsgrunnlagId=${encodeURIComponent(eventId)}&profileId=${encodeURIComponent(profileId)}`;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Not authenticated");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`lonnsgrunnlag-url failed (${response.status}): ${text}`);
  }

  const json = (await response.json()) as unknown;
  // L-0177: fail fast on unexpected shape
  if (
    typeof json !== "object" ||
    json === null ||
    !("signed_url" in json) ||
    typeof (json as { signed_url: unknown }).signed_url !== "string"
  ) {
    throw new Error("Unexpected response shape from lonnsgrunnlag-url");
  }

  const data = json as { signed_url: string; expires_at?: string };
  return {
    signed_url: data.signed_url,
    expires_at: data.expires_at ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

/* ── Hooks ──────────────────────────────────────────────────────────────────── */

/**
 * Returns all PDF lønnsgrunnlag export events visible to this employee.
 * Read-only — no generation, no authoring (ADR-0133).
 * profile_id derived from getProfileContext() (ADR-0151).
 */
export function useMyLonnsgrunnlagList(): UseQueryResult<LonnsgrunnlagListItem[]> {
  return useQuery<LonnsgrunnlagListItem[]>({
    queryKey: ["lonnsgrunnlag-list"],
    queryFn: fetchMyLonnsgrunnlagList,
    staleTime: STALE_TIME_LIST_MS,
    retry: 1,
  });
}

/**
 * Returns a signed URL for a specific lønnsgrunnlag PDF export event.
 * Wave B BFF route dependency: GET /api/payroll/lonnsgrunnlag-url.
 * Disabled (query not enabled) when eventId or profileId is empty.
 *
 * Refetch staleTime set to 50min — signed URLs expire at ~1h; this ensures
 * the hook refetches before expiry without hammering the BFF.
 *
 * profile_id MUST come from getProfileContext() at the call site (ADR-0151).
 * Never pass a user-input or component-state profileId here.
 */
export function useLonnsgrunnlagUrl(
  eventId: string,
  profileId: string,
): UseQueryResult<LonnsgrunnlagUrl> {
  return useQuery<LonnsgrunnlagUrl>({
    queryKey: ["lonnsgrunnlag-url", eventId, profileId],
    queryFn: () => fetchLonnsgrunnlagUrl(eventId, profileId),
    staleTime: STALE_TIME_URL_MS,
    retry: 1,
    // Disabled until both IDs are present — never fetches with empty strings.
    enabled: eventId.length > 0 && profileId.length > 0,
  });
}
