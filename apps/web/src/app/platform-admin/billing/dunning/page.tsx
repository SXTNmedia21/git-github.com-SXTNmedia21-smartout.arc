import { redirect } from "next/navigation";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

import { DunningKanban, type DunningInvoice, type TierKey } from "./_components/dunning-kanban";

// Phase 8.1 — Dunning kanban
//
// Overdue invoices grouped into four age tiers. Platform-admin
// operational surface for chasing late payments. Data source:
// invoice WHERE status = 'overdue', ordered by due_at ascending
// (oldest first → appear at top of 30+ column). The query-then-group
// split is intentional: a single pass through the list assigns
// days_overdue + tier per row so the client component stays pure.

export default async function DunningPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoice")
    .select(
      "invoice_id, invoice_number, company:company(name), amount_incl_vat, due_at, dunning_status",
    )
    .eq("status", "overdue")
    .order("due_at", { ascending: true });

  if (error) {
    console.error("[dunning/page] query failed:", error);
  }

  const today = Date.now();
  const invoices: DunningInvoice[] = (data ?? [])
    .filter((inv): inv is typeof inv & { due_at: string } => Boolean(inv.due_at))
    .map((inv) => {
      const days_overdue = Math.max(
        0,
        Math.floor((today - new Date(inv.due_at).getTime()) / (24 * 60 * 60 * 1000)),
      );
      return {
        invoice_id: inv.invoice_id,
        invoice_number: inv.invoice_number,
        company_name: inv.company?.name ?? "—",
        amount_incl_vat: Number(inv.amount_incl_vat),
        due_at: inv.due_at,
        dunning_status: inv.dunning_status,
        days_overdue,
        tier: tierFor(days_overdue),
      };
    });

  const grouped: Record<TierKey, DunningInvoice[]> = {
    "0_7": [],
    "8_14": [],
    "15_29": [],
    "30plus": [],
  };
  for (const inv of invoices) grouped[inv.tier].push(inv);

  return <DunningKanban grouped={grouped} />;
}

function tierFor(days: number): TierKey {
  if (days >= 30) return "30plus";
  if (days >= 15) return "15_29";
  if (days >= 8) return "8_14";
  return "0_7";
}
