"use client";

/**
 * TimebankPanel — shows the employee's timebank balance across all account types.
 *
 * Reads from payroll.timebank_entry, computes running balance per account_type,
 * and displays the balance with the last few entries.
 *
 * Placed inside LonnsprofilSection (HR tab, /people/[id]).
 * Read-only display — adjustments happen via Botsson chat tool `adjust_timebank_balance`
 * or the admin interface (Phase 2).
 *
 * ADR-0133: authoring via web only. Mobile sees balances via my-salary surface.
 * ADR-0078: no PII in this view — timebank balances are not Høy-PII.
 */

import { useEffect, useState } from "react";
import { createClient } from "@smartout/supabase/client";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Banknote, Clock, Gift, Loader2 } from "lucide-react";
import type { Database } from "@smartout/supabase";

type TimebankEntry = Database["payroll"]["Tables"]["timebank_entry"]["Row"];
type AccountType = NonNullable<TimebankEntry["account_type"]>;

const ACCOUNT_LABELS: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  holiday: { label: "Feriepenger", icon: Banknote },
  toil: { label: "Avspasering (TOIL)", icon: Clock },
  wellness: { label: "Velferdsdager", icon: Gift },
};

const CREDIT_TYPES: TimebankEntry["entry_type"][] = ["accrual", "carry_over", "adjustment"];
const DEBIT_TYPES: TimebankEntry["entry_type"][] = ["withdrawal", "expiry", "payout"];

// timebank_entry.hours column always stores hours regardless of value_unit.
// value_amount + value_unit is the canonical amount (NOK or hours).

type AccountSummary = {
  accountType: AccountType;
  balanceNok: number;
  balanceHours: number;
  lastEntries: TimebankEntry[];
};

type Props = {
  profileId: string;
  workspaceId: string;
};

export function TimebankPanel({ profileId, workspaceId }: Props) {
  const [summaries, setSummaries] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data, error: fetchErr } = await supabase
        .schema("payroll")
        .from("timebank_entry")
        .select("*")
        .eq("profile_id", profileId)
        .eq("workspace_id", workspaceId)
        .order("effective_date", { ascending: false })
        .limit(100);

      if (cancelled) return;
      if (fetchErr) {
        setError("Kunne ikke laste tidskontoer.");
        setLoading(false);
        return;
      }

      const entries = (data ?? []) as TimebankEntry[];

      // Group by account_type
      const byAccount = new Map<AccountType, TimebankEntry[]>();
      for (const e of entries) {
        const type = (e.account_type ?? "toil") as AccountType;
        const existing = byAccount.get(type) ?? [];
        existing.push(e);
        byAccount.set(type, existing);
      }

      const result: AccountSummary[] = [];
      for (const [accountType, acctEntries] of byAccount) {
        let balanceNok = 0;
        let balanceHours = 0;
        for (const e of [...acctEntries].reverse()) {
          const isCredit = CREDIT_TYPES.includes(e.entry_type);
          const isDebit = DEBIT_TYPES.includes(e.entry_type);
          // value_unit: "NOK" → value_amount is NOK; "hours" → value_amount is hours
          const valueIsNok = e.value_unit === "NOK";
          const valueIsHours = e.value_unit === "hours";
          if (isCredit) {
            if (valueIsNok) balanceNok += e.value_amount ?? 0;
            else if (valueIsHours) balanceHours += e.value_amount ?? 0;
            else balanceHours += e.hours ?? 0; // fallback to hours column
          } else if (isDebit) {
            if (valueIsNok) balanceNok -= e.value_amount ?? 0;
            else if (valueIsHours) balanceHours -= e.value_amount ?? 0;
            else balanceHours -= e.hours ?? 0;
          }
        }
        result.push({
          accountType,
          balanceNok,
          balanceHours,
          lastEntries: acctEntries.slice(0, 3),
        });
      }

      setSummaries(result);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, workspaceId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm">
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Laster tidskontoer…</span>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!summaries.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Ingen tidskontoer registrert for denne perioden.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((s) => {
        const cfg = ACCOUNT_LABELS[s.accountType] ?? ACCOUNT_LABELS.toil!;
        const AccountIcon = cfg!.icon;
        return (
          <div key={s.accountType} className="border-border rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AccountIcon className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm font-medium">{cfg!.label}</span>
              </div>
              <div className="text-right">
                {s.balanceNok !== 0 && (
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {new Intl.NumberFormat("nb-NO", {
                      style: "currency",
                      currency: "NOK",
                      maximumFractionDigits: 0,
                    }).format(s.balanceNok)}
                  </p>
                )}
                {s.balanceHours !== 0 && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {s.balanceHours.toFixed(1)} timer
                  </p>
                )}
              </div>
            </div>

            {/* Last 3 entries */}
            {s.lastEntries.length > 0 && (
              <div className="mt-2 space-y-1 border-t pt-2">
                {s.lastEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {format(new Date(e.effective_date), "d. MMM yyyy", { locale: nb })} —{" "}
                      {e.entry_type}
                    </span>
                    <span
                      className={
                        CREDIT_TYPES.includes(e.entry_type) ? "text-emerald-600" : "text-red-600"
                      }
                    >
                      {CREDIT_TYPES.includes(e.entry_type) ? "+" : "-"}
                      {e.value_unit === "NOK"
                        ? new Intl.NumberFormat("nb-NO", {
                            style: "currency",
                            currency: "NOK",
                            maximumFractionDigits: 0,
                          }).format(e.value_amount ?? 0)
                        : `${(e.value_amount ?? e.hours ?? 0).toFixed(1)} t`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
