import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { listPayments } from "@smartout/billing";
import { getSuperAdminId } from "@/lib/platform-admin";

import { PaymentsList } from "./_components/PaymentsList";
import { PaymentsListSkeleton } from "./_components/PaymentsListSkeleton";

// Fase 3A B3 — platform-admin payments dashboard.
//
// Server Component shell: Godmode gate, then hands off to a Suspense
// boundary so the skeleton paints while listPayments() resolves. List
// cap is 500 rows (Fase 3A default 50); fetch-all-and-filter-client is
// fine for Fase 3A volumes (single-digit hundreds of payments across
// all companies). Fase 3B will push filters to the URL + server when
// we outgrow the cap.
//
// Mobile: per Frontend R9 this is a platform-admin-only surface, so no
// mobile-specific responsive rework — the table uses the same
// overflow-x pattern as the invoice list.

export default async function PaymentsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  return (
    <Suspense fallback={<PaymentsListSkeleton />}>
      <PaymentsPanel />
    </Suspense>
  );
}

async function PaymentsPanel() {
  const supabase = createAdminClient();
  // limit 500 keeps Fase 3A dashboard snappy. Rows are sorted
  // created_at DESC so the freshest activity stays at the top.
  const payments = await listPayments(supabase, { limit: 500 });

  const rows = payments.map((p) => ({
    payment_id: p.payment_id,
    invoice_id: p.invoice_id,
    company_id: p.company_id,
    company_name: p.company?.name ?? null,
    amount: Number(p.amount),
    refunded_amount: p.refunded_amount != null ? Number(p.refunded_amount) : null,
    currency: p.currency,
    status: p.status,
    payment_method: p.payment_method,
    external_id: p.external_id,
    paid_at: p.paid_at,
    created_at: p.created_at,
  }));

  return <PaymentsList payments={rows} />;
}
