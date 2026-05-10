"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LineDrawer } from "./LineDrawer";
import type { PayrollLine } from "../_hooks/use-payroll-lines";

type Props = {
  lines: PayrollLine[];
  isLoading: boolean;
  periodId: string;
  /** Period open/locked/etc status — forwarded to LineDrawer for guard logic. */
  periodStatus?: string;
  /** Workspace ID — forwarded to LineDrawer for ManualSupplementForm. */
  workspaceId?: string;
  /** When true: show "Foreslå endring" button on derived lines (Fix 5, admin-only). */
  isAdmin?: boolean;
};

/** Format NOK amount with two decimals */
function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format hours from net_minutes */
function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}t`;
  return `${h}t ${m}m`;
}

/**
 * Per-profile payroll summary table for a period.
 *
 * Columns: Navn, Vakter, Timer, Grunnlønn, Tillegg, Trekk, Totallønn.
 * Includes a totals row at the bottom.
 *
 * Connects to: usePayrollLines (aggregated from payroll.calculation rows)
 */
export function LinesTable({
  lines,
  isLoading,
  periodId,
  periodStatus,
  workspaceId,
  isAdmin = false,
}: Props) {
  const [drawerLine, setDrawerLine] = useState<PayrollLine | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="text-muted-foreground py-12 text-center text-sm">
        Ingen beregningslinjer for denne perioden. Kjør beregning for å generere data.
      </div>
    );
  }

  const totals = lines.reduce(
    (acc, l) => ({
      basePay: acc.basePay + l.basePay,
      supplements: acc.supplements + l.supplements,
      deductions: acc.deductions + l.deductions,
      totalPay: acc.totalPay + l.totalPay,
      shiftCount: acc.shiftCount + l.shiftCount,
      netMinutes: acc.netMinutes + l.netMinutes,
    }),
    { basePay: 0, supplements: 0, deductions: 0, totalPay: 0, shiftCount: 0, netMinutes: 0 },
  );

  return (
    <>
      <LineDrawer
        open={!!drawerLine}
        onClose={() => setDrawerLine(null)}
        periodId={periodId}
        line={drawerLine}
        periodStatus={periodStatus}
        workspaceId={workspaceId}
        isAdmin={isAdmin}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs tracking-wider uppercase">
              <th className="pr-4 pb-2 font-medium">Navn</th>
              <th className="pr-4 pb-2 text-right font-medium">Vakter</th>
              <th className="pr-4 pb-2 text-right font-medium">Timer</th>
              <th className="pr-4 pb-2 text-right font-medium">Grunnlønn</th>
              <th className="pr-4 pb-2 text-right font-medium">Tillegg</th>
              <th className="pr-4 pb-2 text-right font-medium">Trekk</th>
              <th className="pb-2 text-right font-medium">Totallønn</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr
                key={line.profileId}
                className="hover:bg-muted/40 cursor-pointer border-b transition-colors last:border-b-0"
                onClick={() => setDrawerLine(line)}
                role="button"
                aria-label={`Åpne detaljer for ${line.displayName}`}
              >
                <td className="py-2.5 pr-4 font-medium">{line.displayName}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{line.shiftCount}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {formatHours(line.netMinutes)}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatNok(line.basePay)}</td>
                <td className="py-2.5 pr-4 text-right text-emerald-600 tabular-nums">
                  {line.supplements > 0 ? `+${formatNok(line.supplements)}` : "—"}
                </td>
                <td className="py-2.5 pr-4 text-right text-red-600 tabular-nums">
                  {line.deductions > 0 ? `-${formatNok(line.deductions)}` : "—"}
                </td>
                <td className="py-2.5 text-right font-semibold tabular-nums">
                  {formatNok(line.totalPay)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="pt-3 pr-4">Totalt</td>
              <td className="pt-3 pr-4 text-right tabular-nums">{totals.shiftCount}</td>
              <td className="pt-3 pr-4 text-right tabular-nums">
                {formatHours(totals.netMinutes)}
              </td>
              <td className="pt-3 pr-4 text-right tabular-nums">{formatNok(totals.basePay)}</td>
              <td className="pt-3 pr-4 text-right text-emerald-600 tabular-nums">
                {totals.supplements > 0 ? `+${formatNok(totals.supplements)}` : "—"}
              </td>
              <td className="pt-3 pr-4 text-right text-red-600 tabular-nums">
                {totals.deductions > 0 ? `-${formatNok(totals.deductions)}` : "—"}
              </td>
              <td className="pt-3 text-right tabular-nums">{formatNok(totals.totalPay)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
