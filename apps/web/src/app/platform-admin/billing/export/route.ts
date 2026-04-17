import type { NextRequest } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

// Phase 8.3 — CSV export Route Handler.
//
// GET /platform-admin/billing/export?period_from=YYYY-MM-DD&period_to=YYYY-MM-DD
// -> text/csv (UTF-8 BOM for Excel, semicolon delimiter, Norwegian
//    decimal separator).
//
// Scope: invoices with period_from >= ?period_from AND period_to <=
// ?period_to. Bounded at 5000 rows — above that the admin should use
// a direct DB export.

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ExportRow = {
  invoice_number: number | null;
  company: { name: string | null; org_number: string | null } | null;
  period_from: string;
  period_to: string;
  amount_excl_vat: number;
  vat_amount: number;
  amount_incl_vat: number;
  status: string;
  issued_at: string | null;
  paid_at: string | null;
};

export async function GET(req: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) return new Response("unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const periodFrom = searchParams.get("period_from");
  const periodTo = searchParams.get("period_to");
  const companyId = searchParams.get("company");

  if (!periodFrom || !DATE_RE.test(periodFrom)) {
    return new Response("invalid_period_from", { status: 400 });
  }
  if (!periodTo || !DATE_RE.test(periodTo)) {
    return new Response("invalid_period_to", { status: 400 });
  }
  if (companyId && !UUID_RE.test(companyId)) {
    return new Response("invalid_company", { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("invoice")
    .select(
      "invoice_number, company:company(name, org_number), period_from, period_to, amount_excl_vat, vat_amount, amount_incl_vat, status, issued_at, paid_at",
    )
    .gte("period_from", periodFrom)
    .lte("period_to", periodTo)
    .order("invoice_number", { ascending: true, nullsFirst: false })
    .limit(5000);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[billing/export] query failed:", error);
    return new Response("query_failed", { status: 500 });
  }

  const rows = (data ?? []) as ExportRow[];
  const csv = toCsv(rows);
  const bom = "\uFEFF"; // UTF-8 BOM — Excel needs this to detect encoding
  const filename = `smartout-invoices-${periodFrom}-to-${periodTo}.csv`;

  return new Response(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function toCsv(rows: ExportRow[]): string {
  const header =
    "Fakturanr;Selskap;Org.nr;Periode fra;Periode til;Eks. mva;Mva;Inkl. mva;Status;Utstedt;Betalt";

  const body = rows.map((r) =>
    [
      r.invoice_number ?? "",
      csvField(r.company?.name ?? ""),
      csvField(r.company?.org_number ?? ""),
      r.period_from,
      r.period_to,
      noMoney(r.amount_excl_vat),
      noMoney(r.vat_amount),
      noMoney(r.amount_incl_vat),
      r.status,
      r.issued_at?.split("T")[0] ?? "",
      r.paid_at?.split("T")[0] ?? "",
    ].join(";"),
  );

  return [header, ...body].join("\r\n"); // CRLF for Excel parity
}

// Norwegian decimal formatting: 1.234,56 — toFixed(2) then swap.
function noMoney(n: number): string {
  return Number(n).toFixed(2).replace(".", ",");
}

// Quote + escape internal double-quotes if the field contains ; or "
function csvField(s: string): string {
  if (s.includes(";") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
