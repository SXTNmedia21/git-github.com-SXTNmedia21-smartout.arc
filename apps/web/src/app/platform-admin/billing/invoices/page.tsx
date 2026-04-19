import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import type { Invoice } from "@smartout/billing";

import { InvoiceFilterBar } from "./_components/invoice-filter-bar";
import { InvoiceTable, type InvoiceListRow } from "./_components/invoice-table";
import { InvoiceDetailSheet } from "./_components/invoice-detail-sheet";
import { AdHocInvoiceDrawer } from "./_components/ad-hoc-invoice-drawer";

// RFC-4122 UUID format. Strict enough to reject probe strings without
// pulling Zod into a Server Component for one field.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Phase 6.2 — platform-admin invoice list.
//
// Filters via searchParams (?status=paid, ?company=<uuid>). A row click
// adds ?preview=<invoice_id> which renders <InvoiceDetailSheet/> as a
// side panel without navigating away. Cache: no-cache (fresh read every
// time — billing admin views short-lived).

type SearchParams = {
  status?: string;
  company?: string;
  preview?: string;
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [adminId, params] = await Promise.all([getSuperAdminId(), searchParams]);
  if (!adminId) redirect("/");

  const supabase = createAdminClient();

  let query = supabase
    .from("invoice")
    .select(
      "invoice_id, invoice_number, company_id, company:company(name), invoice_type, status, dunning_status, period_from, period_to, due_at, amount_incl_vat",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const allowedStatuses: Array<Invoice["status"]> = [
    "draft",
    "issued",
    "sent",
    "paid",
    "overdue",
    "void",
    "uncollectible",
  ];
  if (params.status && allowedStatuses.includes(params.status as Invoice["status"])) {
    query = query.eq("status", params.status as Invoice["status"]);
  }
  // Validate company_id as UUID before filter — a probe string would
  // otherwise reach the Postgres cast and surface as a 500. Invalid
  // UUID -> ignore filter silently; the user sees an unfiltered list.
  if (params.company && UUID_RE.test(params.company)) {
    query = query.eq("company_id", params.company);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[billing/invoices] list query failed:", error);
  }

  const invoices = (data ?? []) as InvoiceListRow[];

  // Company options for the ad-hoc invoice drawer. Fetched server-side
  // so the client never exposes the full company roster as a prop
  // blob larger than needed; ordering by name for the picker.
  const { data: companyRows } = await supabase
    .from("company")
    .select("company_id, name")
    .order("name", { ascending: true })
    .limit(500);
  const companies = (companyRows ?? []).map((c) => ({ company_id: c.company_id, name: c.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <InvoiceFilterBar />
        {/* B5: ad-hoc invoice drawer */}
        <AdHocInvoiceDrawer companies={companies} />
      </div>
      <InvoiceTable invoices={invoices} />
      {/* Always mounted — open derives from ?preview in searchParams.
          Conditional mount caused Radix to tear down mid-close, racing
          Next's router.push and surfacing as null.dispatchEvent. */}
      <InvoiceDetailSheet />
    </div>
  );
}
