"use server";

import { createClient } from "@smartout/supabase/server";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Invoice } from "@smartout/billing";

// Phase 10.1 — workspace-admin read-side Server Actions.
//
// Auth pattern: resolve the current user via the request-bound
// server client (cookie-aware JWT), then use the service-role
// admin client to fetch invoices scoped to the caller's company via
// company_member. This is the "explicit company resolution" pattern
// — we never trust a client-supplied company_id for reads.
//
// Authorisation: only admin / owner roles in company_member can
// read billing. Other roles get an empty list. This is a billing
// admin surface; workers have no invoice visibility.

type CompanyScope = { company_id: string; role: string };

async function resolveCallerCompany(): Promise<CompanyScope | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("company_member")
    .select("company_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .in("role", ["admin", "owner"])
    .limit(1)
    .maybeSingle();

  if (!member) return null;
  return { company_id: member.company_id, role: member.role };
}

export async function getMyCompanyInvoices(filters?: { status?: string }): Promise<Invoice[]> {
  const scope = await resolveCallerCompany();
  if (!scope) return [];

  const admin = createAdminClient();
  let query = admin
    .from("invoice")
    .select("*")
    .eq("company_id", scope.company_id)
    .order("issued_at", { ascending: false, nullsFirst: true })
    .limit(48);

  if (filters?.status) {
    const allowed: Array<Invoice["status"]> = [
      "draft",
      "issued",
      "sent",
      "paid",
      "overdue",
      "void",
      "uncollectible",
    ];
    if (allowed.includes(filters.status as Invoice["status"])) {
      query = query.eq("status", filters.status as Invoice["status"]);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getMyCompanyInvoices] failed:", error);
    return [];
  }
  return data ?? [];
}

export async function getMyInvoiceDetail(invoiceId: string): Promise<{
  invoice: Invoice;
  line_items: unknown[];
} | null> {
  const scope = await resolveCallerCompany();
  if (!scope) return null;

  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from("invoice")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("company_id", scope.company_id)
    .maybeSingle();

  if (error || !invoice) return null;

  const { data: lineItems } = await admin
    .from("invoice_line_item")
    .select("*")
    .eq("invoice_id", invoice.invoice_id);

  return { invoice, line_items: lineItems ?? [] };
}
