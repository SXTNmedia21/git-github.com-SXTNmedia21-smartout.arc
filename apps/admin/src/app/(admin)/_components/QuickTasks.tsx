/**
 * QuickTasks.tsx — quick-action task list on the accountant dashboard.
 *
 * Phase 1: one task type — orders pending "mottatt betalt" marking.
 * Designed as a slot for future task types (org.nr changes, etc.).
 *
 * Nordic Split: CSS vars only.
 */

import Link from "next/link";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QuickTask = {
  label: string;
  href: string;
  count?: number;
};

type Props = {
  pendingOrdersCount: number;
};

export function QuickTasks({ pendingOrdersCount }: Props) {
  const tasks: QuickTask[] = [];

  if (pendingOrdersCount > 0) {
    tasks.push({
      label: `${pendingOrdersCount} ${pendingOrdersCount === 1 ? "ordre venter" : "ordre venter"} «mottatt betalt»-markering`,
      href: "/orders?status=issued,sent,overdue",
      count: pendingOrdersCount,
    });
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Hurtigoppgaver</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <CheckCircle2 className="text-muted-foreground h-4 w-4" />
            Ingen hurtigoppgaver — du er à jour.
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li key={task.href}>
                <Link
                  href={task.href}
                  className="hover:bg-muted flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-foreground">{task.label}</span>
                  <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
