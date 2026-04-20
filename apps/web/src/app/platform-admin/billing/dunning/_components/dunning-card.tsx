"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { DunningInvoice } from "./dunning-kanban";

// Pulse opacity on 30+ day tier to draw the eye (per spec §10.3).
// Honours prefers-reduced-motion — no animation for users who opted
// out. Cards are links to the full invoice detail page.

export function DunningCard({ invoice }: { invoice: DunningInvoice }) {
  const reducedMotion = useReducedMotion();
  const shouldPulse = invoice.tier === "30plus" && !reducedMotion;

  return (
    <Link
      href={`/platform-admin/billing/invoices/${invoice.invoice_id}`}
      className="border-border/40 bg-card hover:border-foreground/30 block rounded-lg border p-4 transition-colors"
    >
      <motion.div
        animate={shouldPulse ? { opacity: [0.65, 1, 0.65] } : {}}
        transition={shouldPulse ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : {}}
      >
        <p className="text-foreground font-semibold">{invoice.company_name}</p>
        <p className="text-muted-foreground font-mono text-xs">#{invoice.invoice_number ?? "—"}</p>
        <p className="font-heading mt-2 font-mono text-lg tabular-nums">
          {invoice.amount_incl_vat.toLocaleString("nb-NO")} kr
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {invoice.days_overdue} dager forsinket
          {invoice.dunning_status && invoice.dunning_status !== "none"
            ? ` · ${dunningLabel(invoice.dunning_status)}`
            : null}
        </p>
      </motion.div>
    </Link>
  );
}

function dunningLabel(status: string): string {
  switch (status) {
    case "in_negotiation":
      return "i dialog";
    case "reminder_sent":
      return "purring sendt";
    case "escalated":
      return "eskalert";
    default:
      return status;
  }
}
