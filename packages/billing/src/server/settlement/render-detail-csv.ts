import "server-only";

// render-detail-csv.ts — CSV artefakt 2: Detalj-linjer per ordre.
//
// One row per invoice in the period for all granted workspaces/companies.
// Column order matches Tripletex / Fiken import format per
// PLAN-avstemming.md §Artefakt 2.
// UTF-8 BOM prefix included so Excel / Tripletex detect encoding.
// GDPR: no PII beyond org_nr + monetary amounts.
//
// NOTE: Invoice table has no workspace_id column — it links via company_id.
// We filter invoices by company_ids (derived from workspace_ids in run.ts)
// and the billing period (period_from).

import { stringify } from "csv-stringify/sync";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

type BillingClient = SupabaseClient<Database>;

/** CSV column headers — Tripletex / Fiken import-klar. */
const CSV_HEADERS = [
  "date",
  "invoice_number",
  "org_nr",
  "company",
  "workspace",
  "amount_excl_vat",
  "vat_rate",
  "vat",
  "amount_incl_vat",
  "status",
  "paid_at",
] as const;

/** One row in the detail CSV. */
type CsvRow = Record<(typeof CSV_HEADERS)[number], string | number | null>;

/**
 * Render the per-order detail CSV for a settlement period.
 *
 * Queries invoices + company info via service-role client (bypasses RLS —
 * called only after accountant grant check in run.ts).
 * Filters by company_ids (derived from workspace_ids) + billing period.
 *
 * GDPR: columns limited to org_nr, company name, amounts, dates,
 * and invoice numbers. No profile names or email addresses.
 *
 * @param serviceClient - Service-role Supabase client.
 * @param companyIds - Company IDs for the granted workspaces.
 * @param workspaceNames - Map of company_id → workspace name (for CSV column).
 * @param periodStart - ISO date string, e.g. "2026-09-01".
 * @param periodEnd - ISO date string, e.g. "2026-09-30".
 * @returns UTF-8 BOM + CSV string.
 */
export async function renderDetailCsv(
  serviceClient: BillingClient,
  companyIds: string[],
  workspaceNames: Map<string, string>,
  periodStart: string,
  periodEnd: string,
): Promise<string> {
  if (companyIds.length === 0) {
    const header = stringify([CSV_HEADERS], { header: false });
    return "﻿" + header;
  }

  // Fetch invoices for the period across all granted companies.
  // period_from is the billing cycle start date — filter on this for the period.
  // issued_at is the invoice issue timestamp (use for the "date" column when present).
  // eslint-disable-next-line smartout/no-direct-supabase-write
  const { data: invoices, error } = await serviceClient
    .from("invoice")
    .select(
      `
      invoice_id,
      invoice_number,
      issued_at,
      period_from,
      status,
      paid_at,
      payment_date,
      company_id,
      amount_excl_vat,
      vat_amount,
      vat_rate,
      amount_incl_vat,
      company!inner(
        company_id,
        name,
        org_number
      )
    `,
    )
    .in("company_id", companyIds)
    .gte("period_from", periodStart)
    .lte("period_from", periodEnd)
    .order("period_from", { ascending: true })
    .order("invoice_number", { ascending: true });

  if (error) {
    throw new Error(`renderDetailCsv: invoice query failed — ${error.message}`);
  }

  const rows: CsvRow[] = (invoices ?? []).map((inv) => {
    const company = inv.company as {
      company_id: string;
      name: string;
      org_number: string | null;
    } | null;

    // Map company_id → workspace name (best effort — one workspace per company in scope).
    const wsName = company?.company_id ? (workspaceNames.get(company.company_id) ?? "") : "";

    return {
      // Use issued_at date part if present, fall back to period_from.
      date: inv.issued_at ? inv.issued_at.split("T")[0]! : (inv.period_from ?? ""),
      invoice_number: inv.invoice_number ?? "",
      org_nr: company?.org_number ?? "",
      company: company?.name ?? "",
      workspace: wsName,
      amount_excl_vat: inv.amount_excl_vat,
      vat_rate: inv.vat_rate,
      vat: inv.vat_amount,
      amount_incl_vat: inv.amount_incl_vat,
      status: inv.status ?? "",
      paid_at: inv.paid_at ?? inv.payment_date ?? "",
    };
  });

  const csvContent = stringify(rows, {
    header: true,
    columns: CSV_HEADERS as unknown as string[],
  });

  // Prepend UTF-8 BOM — Tripletex / Fiken / Excel need it to detect encoding.
  return "﻿" + csvContent;
}
