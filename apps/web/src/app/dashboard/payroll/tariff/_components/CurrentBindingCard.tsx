/**
 * CurrentBindingCard — displays the active tariff binding for the workspace.
 *
 * Shows union name, law version, effective-from date, and paragraf references.
 * When no binding exists, renders the no-binding empty state (ADR-0357 §f).
 *
 * Skeleton: shown while query is loading (ADR-0357 §e).
 * Motion: list items use Framer Motion spring with useReducedMotion guard.
 */
"use client";

import { FileText, CalendarDays, BookOpen, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { CurrentTariffResponse } from "@smartout/types";

type Props = {
  data: CurrentTariffResponse | undefined;
  isLoading: boolean;
  error: Error | null;
};

export function CurrentBindingCard({ data, isLoading, error }: Props) {
  const prefersReduced = useReducedMotion();

  if (isLoading) {
    return (
      <div
        className="border-border bg-background rounded-lg border p-5"
        role="status"
        aria-label="Laster tariffbinding…"
      >
        <Skeleton className="mb-3 h-5 w-48" />
        <Skeleton className="mb-2 h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-5">
        <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-destructive text-sm">Kunne ikke laste tariffbinding. Prøv igjen.</p>
      </div>
    );
  }

  // BFF error envelope
  if (data && !data.ok) {
    return (
      <div className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-5">
        <AlertCircle className="text-destructive mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-destructive text-sm">{data.error.message}</p>
      </div>
    );
  }

  const binding = data?.ok ? data.data : null;

  // No binding — empty state (ADR-0357 §f)
  if (!binding?.is_bound) {
    return (
      <div className="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <FileText className="text-muted-foreground h-8 w-8" aria-hidden="true" />
        <div>
          <p className="text-foreground text-sm font-medium">Ingen tariffbinding</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Arbeidsplassen er ikke knyttet til en tariffavtale. Bruk skjemaet nedenfor for å sette
            opp tariffbinding.
          </p>
        </div>
      </div>
    );
  }

  const paragrafRefs = binding.paragraf_references ?? [];

  return (
    <motion.div
      initial={prefersReduced ? {} : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReduced ? { duration: 0 } : motionTokens.spring}
      className="border-border bg-background rounded-lg border p-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden="true" />
          <h2 className="text-foreground text-sm font-semibold">
            {binding.union_name ?? "Ukjent tariff"}
          </h2>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {binding.law_version}
        </Badge>
      </div>

      {/* Effective from */}
      <div className="mt-3 flex items-center gap-2">
        <CalendarDays className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="text-muted-foreground text-xs">
          Gjelder fra{" "}
          <time
            dateTime={binding.effective_from ?? undefined}
            className="text-foreground font-medium"
          >
            {binding.effective_from
              ? new Date(binding.effective_from).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </time>
        </p>
      </div>

      {/* Paragraf references */}
      {paragrafRefs.length > 0 && (
        <>
          <Separator className="my-4" />
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Tarifffastlagte satser
          </p>
          <ul className="flex flex-col gap-2" role="list" aria-label="Paragraf-referanser">
            {paragrafRefs.map((ref, i) => (
              <li key={i} className="flex items-start justify-between gap-4 text-xs">
                <span className="text-muted-foreground shrink-0 font-mono">{ref.paragraf}</span>
                <span className="text-foreground flex-1">{ref.description}</span>
                {ref.rate_value !== undefined && (
                  <span className="text-foreground shrink-0 font-medium tabular-nums">
                    {ref.rate_type === "percentage"
                      ? `${ref.rate_value}%`
                      : ref.rate_type === "fixed_amount"
                        ? `kr ${ref.rate_value.toFixed(2)}`
                        : `kr ${ref.rate_value.toFixed(2)}/t`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.div>
  );
}
