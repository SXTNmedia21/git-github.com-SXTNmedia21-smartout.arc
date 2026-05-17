/**
 * SupplementOverridesList — read-only list of workspace supplement overrides.
 *
 * Supplements are workspace-level adjustments on top of the tariff baseline
 * (e.g. a higher evening allowance than Riksavtalen §6 mandates).
 *
 * Data comes from the same currentTariff hook. The BFF current endpoint does
 * not include the supplement list in v1 — this list will be populated once
 * Track 1 exposes the supplements in the GET response. For now the component
 * renders a placeholder when no supplements are passed.
 *
 * Motion: fade-in card list with useReducedMotion guard.
 */
"use client";

import { PlusCircle, Percent, Coins, Clock } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { rateTypeSchema } from "@smartout/types";
import type { z } from "zod";

type RateType = z.infer<typeof rateTypeSchema>;

// Supplement shape — mirrors the data returned by add_supplement_override capability
export type SupplementOverride = {
  supplement_rule_id: string;
  name: string;
  supplement_type: string;
  rate_value: number;
  rate_type: RateType;
  paragraf_ref?: string | null;
};

type Props = {
  overrides?: SupplementOverride[];
  isLoading?: boolean;
};

function RateIcon({ rateType }: { rateType: RateType }) {
  if (rateType === "percentage") return <Percent className="h-3 w-3" aria-hidden="true" />;
  if (rateType === "fixed_per_shift") return <Coins className="h-3 w-3" aria-hidden="true" />;
  return <Clock className="h-3 w-3" aria-hidden="true" />;
}

function formatRate(value: number, type: RateType): string {
  if (type === "percentage") return `${value}%`;
  if (type === "fixed_per_shift") return `kr ${value.toFixed(2)}/vakt`;
  return `kr ${value.toFixed(2)}/t`;
}

export function SupplementOverridesList({ overrides, isLoading }: Props) {
  const prefersReduced = useReducedMotion();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="Laster tillegg…">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!overrides || overrides.length === 0) {
    return (
      <div className="border-border rounded-lg border border-dashed p-5 text-center">
        <PlusCircle className="text-muted-foreground mx-auto mb-2 h-6 w-6" aria-hidden="true" />
        <p className="text-muted-foreground text-xs">
          Ingen lokale tillegg registrert. Legg til tillegg nedenfor.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" role="list" aria-label="Lokale tillegg">
      {overrides.map((override, i) => (
        <motion.li
          key={override.supplement_rule_id}
          initial={prefersReduced ? {} : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            prefersReduced ? { duration: 0 } : { ...motionTokens.spring, delay: i * 0.05 }
          }
          className="border-border bg-background flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{override.name}</p>
            {override.paragraf_ref && (
              <p className="text-muted-foreground font-mono text-xs">{override.paragraf_ref}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <RateIcon rateType={override.rate_type} />
              {formatRate(override.rate_value, override.rate_type)}
            </Badge>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
