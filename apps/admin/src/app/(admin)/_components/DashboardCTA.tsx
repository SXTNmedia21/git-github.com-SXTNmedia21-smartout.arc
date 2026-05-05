/**
 * DashboardCTA.tsx — primary action card on the accountant dashboard.
 *
 * Shows the current month period summary and a prominent "Kjør avstemming"
 * button that links to /avstemming/run.
 *
 * Rendering: pure Server Component — no client state needed.
 * Nordic Split: CSS variables only, no hardcoded color values.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarDays, ArrowRight } from "lucide-react";

type Props = {
  periodLabel: string; // e.g. "September 2026"
  periodEnd: string; // e.g. "2026-09-30"
  workspacesCount: number;
  ordersCount: number;
  totalNok: number;
};

/** Format a date string as "30.09.2026" (Norwegian locale). */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00Z");
  return date.toLocaleDateString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Compute days from today to a given ISO date. */
function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00Z");
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a number as NOK with Norwegian thousand-separator. */
function formatNok(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function DashboardCTA({
  periodLabel,
  periodEnd,
  workspacesCount,
  ordersCount,
  totalNok,
}: Props) {
  const days = daysUntil(periodEnd);
  const daysLabel =
    days < 0 ? `${Math.abs(days)} dager siden` : days === 0 ? "i dag" : `om ${days} dager`;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-heading text-2xl">Avstemming — {periodLabel}</CardTitle>
            <CardDescription className="mt-1 text-base">
              {workspacesCount} {workspacesCount === 1 ? "workspace" : "workspaces"} · {ordersCount}{" "}
              {ordersCount === 1 ? "ordre" : "ordre"} · {formatNok(totalNok)} NOK
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 flex-shrink-0" />
          <span>
            Periodekutt: {formatDate(periodEnd)} ({daysLabel})
          </span>
        </div>

        <Button asChild size="lg" className="gap-2">
          <Link href="/avstemming/run">
            Kjør avstemming
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
