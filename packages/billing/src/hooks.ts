"use client";

// React Query hooks. The hooks accept an injectable fetcher so web and
// mobile can use the same cache/staleness semantics with different
// auth layers:
//
//   Web (Phase 10):
//     useInvoices(getMyCompanyInvoicesAction, filters)
//     // The Server Action already owns auth + emit().
//
//   Mobile (future):
//     useInvoices(
//       (f) => fetchInvoicesForCompany(supabase, companyId, f),
//       filters,
//     )
//     // Direct client with user-scoped RLS.
//
// Avoids the circular dep trap (packages cannot depend on apps). The
// Server-Action-backed fetcher is created in apps/web; the direct
// Supabase fetcher is created in apps/mobile.

import { useQuery } from "@tanstack/react-query";
import type { UseQueryOptions } from "@tanstack/react-query";
import type { Invoice, InvoiceLineItem, UsageSnapshot } from "./types";
import type { InvoiceListFilters } from "./schemas";

// ─── fetcher types (caller-provided) ───────────────────────────────

export type InvoiceListFetcher = (filters?: InvoiceListFilters) => Promise<Invoice[]>;

export type InvoiceDetailFetcher = (
  invoiceId: string,
) => Promise<{ invoice: Invoice; line_items: InvoiceLineItem[] } | null>;

export type UsageSnapshotFetcher = (
  workspaceId: string,
  periodFrom: string,
  periodTo: string,
) => Promise<UsageSnapshot | null>;

// ─── hooks ─────────────────────────────────────────────────────────

type HookOptions<T> = Omit<UseQueryOptions<T>, "queryKey" | "queryFn" | "staleTime"> & {
  /** Override default 30s staleTime. */
  staleTime?: number;
};

export function useInvoices(
  fetcher: InvoiceListFetcher,
  filters?: InvoiceListFilters,
  options?: HookOptions<Invoice[]>,
) {
  return useQuery({
    queryKey: ["billing", "invoices", filters ?? null],
    queryFn: () => fetcher(filters),
    staleTime: options?.staleTime ?? 30_000,
    ...options,
  });
}

export function useInvoiceDetail(
  fetcher: InvoiceDetailFetcher,
  invoiceId: string | null | undefined,
  options?: HookOptions<{
    invoice: Invoice;
    line_items: InvoiceLineItem[];
  } | null>,
) {
  return useQuery({
    queryKey: ["billing", "invoice", invoiceId ?? null],
    queryFn: () => {
      if (!invoiceId) return Promise.resolve(null);
      return fetcher(invoiceId);
    },
    enabled: !!invoiceId,
    staleTime: options?.staleTime ?? 30_000,
    ...options,
  });
}

export function useUsageSnapshot(
  fetcher: UsageSnapshotFetcher,
  input: {
    workspaceId: string;
    periodFrom: string;
    periodTo: string;
  } | null,
  options?: HookOptions<UsageSnapshot | null>,
) {
  return useQuery({
    queryKey: [
      "billing",
      "usage_snapshot",
      input?.workspaceId ?? null,
      input?.periodFrom ?? null,
      input?.periodTo ?? null,
    ],
    queryFn: () => {
      if (!input) return Promise.resolve(null);
      return fetcher(input.workspaceId, input.periodFrom, input.periodTo);
    },
    enabled: !!input,
    staleTime: options?.staleTime ?? 60_000,
    ...options,
  });
}
