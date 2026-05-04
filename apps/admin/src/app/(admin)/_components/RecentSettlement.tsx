/**
 * RecentSettlement.tsx — "Forrige periode" card on the accountant dashboard.
 *
 * Shows the last completed settlement run with a link to its detail page.
 * Server Component — no interactivity needed.
 * Nordic Split: CSS vars only.
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { SettlementRunRow } from "@/lib/avstemming/fetchers";

type Props = {
  lastRun: SettlementRunRow | null;
};

/** Format ISO datetime as "02.09.2026". */
function formatCompletedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Derive a human period label from period_start, e.g. "August 2026". */
function periodLabelFromStart(periodStart: string): string {
  const date = new Date(periodStart + "T00:00:00Z");
  return date.toLocaleDateString("nb-NO", { year: "numeric", month: "long", timeZone: "UTC" });
}

export function RecentSettlement({ lastRun }: Props) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Forrige periode</CardTitle>
      </CardHeader>
      <CardContent>
        {lastRun === null ? (
          <p className="text-muted-foreground text-sm">Ingen tidligere avstemmingar</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              <div className="text-sm">
                <span className="text-foreground font-medium">
                  {periodLabelFromStart(lastRun.period_start)}
                </span>
                <span className="text-muted-foreground mx-2">·</span>
                <Badge variant="secondary" className="text-xs">
                  Avstemt {formatCompletedAt(lastRun.completed_at)}
                </Badge>
              </div>
            </div>
            <Link
              href={`/avstemming/${lastRun.run_id}`}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors"
            >
              Vis pakke
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
