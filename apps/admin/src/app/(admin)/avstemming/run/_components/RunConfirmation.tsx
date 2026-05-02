"use client";

/**
 * RunConfirmation.tsx — client component for the /avstemming/run form.
 *
 * Workspace checkboxes + period date selectors + summary preview.
 * Submits via useTransition + runSettlement server action.
 * On success → redirect to /avstemming/{run_id}.
 * On error → sonner toast with friendly message.
 *
 * Nordic Split: CSS vars only, no hardcoded colors.
 * ⛔ NEVER auto-trigger — only on explicit button click.
 */

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckSquare, Square, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { runSettlement } from "@/lib/avstemming/actions";
import type { WorkspaceListItem } from "@smartout/billing";

type Props = {
  workspaces: WorkspaceListItem[];
  defaultPeriodStart: string; // "2026-04-01"
  defaultPeriodEnd: string; // "2026-04-30"
  defaultPeriodLabel: string; // "April 2026"
};

/** Format a date string as "01.04.2026". */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

/** Format a number as NOK. */
function fmtNok(n: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function RunConfirmation({
  workspaces,
  defaultPeriodStart,
  defaultPeriodEnd,
  defaultPeriodLabel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Controlled workspace selection — all checked by default.
  const [selected, setSelected] = useState<Set<string>>(
    new Set(workspaces.map((ws) => ws.workspace_id)),
  );

  const [periodStart, setPeriodStart] = useState(defaultPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriodEnd);

  const selectedCount = selected.size;

  function toggleWorkspace(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === workspaces.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(workspaces.map((ws) => ws.workspace_id)));
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (selectedCount === 0) {
      toast.error("Velg minst én workspace for å kjøre avstemming.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await runSettlement({
          period_start: periodStart,
          period_end: periodEnd,
          workspace_ids: Array.from(selected),
        });
        toast.success("Avstemming fullført! Pakken din er klar.");
        router.push(`/avstemming/${result.run_id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ukjent feil under avstemming";
        toast.error(`Avstemming feilet: ${msg}`);
      }
    });
  }

  const allSelected = selected.size === workspaces.length && workspaces.length > 0;
  const someSelected = selected.size > 0 && !allSelected;

  // Estimated total from outstanding_amount for preview hint.
  const estimatedTotal = workspaces
    .filter((ws) => selected.has(ws.workspace_id))
    .reduce((sum, ws) => sum + (ws.outstanding_amount ?? 0), 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Period selector */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Periode</CardTitle>
          <CardDescription>
            Velg periode for avstemmingen. Standard er siste fullstendige måned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="period_start" className="text-foreground text-sm font-medium">
                Fra dato
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <input
                  id="period_start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-ring rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="period_end" className="text-foreground text-sm font-medium">
                Til dato
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <input
                  id="period_end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="border-border bg-background text-foreground focus:ring-ring rounded-md border px-3 py-1.5 text-sm focus:ring-2 focus:outline-none"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="text-muted-foreground text-sm sm:pb-2">
              {fmtDate(periodStart)} – {fmtDate(periodEnd)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace selector */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Workspaces</CardTitle>
              <CardDescription>
                {selectedCount} av {workspaces.length} valgt
              </CardDescription>
            </div>
            <button
              type="button"
              onClick={toggleAll}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
              disabled={isPending}
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {allSelected ? "Fjern alle" : "Velg alle"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {workspaces.map((ws) => {
              const checked = selected.has(ws.workspace_id);
              return (
                <li key={ws.workspace_id}>
                  <button
                    type="button"
                    onClick={() => toggleWorkspace(ws.workspace_id)}
                    disabled={isPending}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      checked
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="flex-shrink-0">
                      {checked ? (
                        <CheckSquare className="text-primary h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </span>
                    <span className="flex-1 font-medium">{ws.workspace_name}</span>
                    <span className="text-muted-foreground text-xs">{ws.company_name}</span>
                    {ws.outstanding_amount != null && ws.outstanding_amount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {fmtNok(ws.outstanding_amount)} NOK
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Summary + submit */}
      <Card className="border-border bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm">
              <p className="text-foreground font-medium">
                {selectedCount} {selectedCount === 1 ? "workspace" : "workspaces"} valgt
              </p>
              {estimatedTotal > 0 && (
                <p className="text-muted-foreground">
                  Estimert utestående: {fmtNok(estimatedTotal)} NOK
                </p>
              )}
              <p className="text-muted-foreground">
                Perioden låses. Ordre-endringer etter dette flagges som avvik.
              </p>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || selectedCount === 0}
              className="gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Kjører avstemming…
                </>
              ) : (
                <>Kjør avstemming — {defaultPeriodLabel}</>
              )}
            </Button>
          </div>
          {isPending && (
            <>
              <Separator className="my-4" />
              <p className="text-muted-foreground text-sm">
                Genererer 4 artefakter (sammendrag, detalj-linjer, faktura-bunke, avvik). Dette kan
                ta 5–30 sekunder.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
