"use client";

import type { Database } from "@smartout/supabase";

import { DunningCard } from "./dunning-card";

// Client-side kanban — the server groups rows, the client renders
// the 4 columns. Kept thin so framer-motion's useReducedMotion
// (in the card) can run client-side without hydration mismatches.

export type TierKey = "0_7" | "8_14" | "15_29" | "30plus";

export type DunningInvoice = {
  invoice_id: string;
  invoice_number: number | null;
  company_name: string;
  amount_incl_vat: number;
  due_at: string;
  dunning_status: Database["public"]["Enums"]["dunning_status"] | null;
  days_overdue: number;
  tier: TierKey;
};

const TIER_META: Array<{ key: TierKey; label: string; hint: string }> = [
  { key: "0_7", label: "0–7 dager", hint: "Friskt forfall" },
  { key: "8_14", label: "8–14 dager", hint: "Første purring" },
  { key: "15_29", label: "15–29 dager", hint: "Andre purring" },
  { key: "30plus", label: "30+ dager", hint: "Inkassoklar" },
];

export function DunningKanban({ grouped }: { grouped: Record<TierKey, DunningInvoice[]> }) {
  const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);

  if (total === 0) {
    return (
      <div className="py-16 text-center">
        <h2 className="font-heading mb-2 text-2xl">Ingen forfalte fakturaer</h2>
        <p className="text-muted-foreground">
          Purre-tavlen er tom. Cronet flagger forfalte fakturaer dag 5 hver måned.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {TIER_META.map((meta) => {
        const invoices = grouped[meta.key];
        return (
          <div key={meta.key} className="space-y-3">
            <header className="space-y-1">
              <h3 className="font-heading text-lg">{meta.label}</h3>
              <p className="text-muted-foreground text-xs">
                {meta.hint} — {invoices.length} faktura
                {invoices.length === 1 ? "" : "er"}
              </p>
            </header>
            <div className="space-y-2">
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">Ingen her.</p>
              ) : (
                invoices.map((invoice) => (
                  <DunningCard key={invoice.invoice_id} invoice={invoice} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
