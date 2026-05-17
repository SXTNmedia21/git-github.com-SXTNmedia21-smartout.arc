/**
 * BindingHistoryList — read-only log of previous tariff bindings.
 *
 * The current BFF GET /api/payroll/tariff/current does not include history
 * (history is returned in the audit blocks of change-responses). This component
 * renders a placeholder pending a dedicated history endpoint in a future phase.
 *
 * When history data is available it will render chronological binding entries
 * with amendment_classifier badges (UP / MATERIAL / ENDRINGSOPPSIGELSE).
 *
 * Motion: staggered list with useReducedMotion guard.
 * Skeleton: 3 row placeholders while loading.
 */
"use client";

import { History } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type HistoryEntry = {
  id: string;
  union_name: string;
  law_version: string;
  effective_from: string;
  effective_to: string | null;
  amendment_classifier: "UP" | "MATERIAL" | "ENDRINGSOPPSIGELSE" | null;
};

type Props = {
  entries?: HistoryEntry[];
  isLoading?: boolean;
};

const classifierLabel: Record<string, string> = {
  UP: "Oppjustering",
  MATERIAL: "Vesentlig endring",
  ENDRINGSOPPSIGELSE: "Endringsoppsigelse",
};

const classifierVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  UP: "secondary",
  MATERIAL: "default",
  ENDRINGSOPPSIGELSE: "destructive",
};

export function BindingHistoryList({ entries, isLoading }: Props) {
  const prefersReduced = useReducedMotion();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Laster historikk…">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // Placeholder: no history endpoint yet — show informational note
  if (!entries || entries.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-5 text-center">
        <History className="text-muted-foreground mx-auto mb-2 h-6 w-6" aria-hidden="true" />
        <p className="text-muted-foreground text-xs">
          Historikk for tariffendringer vises her når den er tilgjengelig.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" role="list" aria-label="Tariffhistorikk">
      {entries.map((entry, i) => (
        <motion.li
          key={entry.id}
          initial={prefersReduced ? {} : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={
            prefersReduced ? { duration: 0 } : { ...motionTokens.spring, delay: i * 0.04 }
          }
          className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{entry.union_name}</p>
            <p className="text-muted-foreground text-xs">
              {entry.law_version} &middot;{" "}
              <time dateTime={entry.effective_from}>
                {new Date(entry.effective_from).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
              {entry.effective_to && (
                <>
                  {" "}
                  &rarr;{" "}
                  <time dateTime={entry.effective_to}>
                    {new Date(entry.effective_to).toLocaleDateString("nb-NO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </>
              )}
            </p>
          </div>
          {entry.amendment_classifier && (
            <Badge variant={classifierVariant[entry.amendment_classifier] ?? "outline"}>
              {classifierLabel[entry.amendment_classifier] ?? entry.amendment_classifier}
            </Badge>
          )}
        </motion.li>
      ))}
    </ul>
  );
}
