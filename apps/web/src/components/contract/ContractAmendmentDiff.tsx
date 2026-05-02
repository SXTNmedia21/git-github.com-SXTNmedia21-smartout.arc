// apps/web/src/components/contract/ContractAmendmentDiff.tsx
//
// What: Field-level diff between original and amended contract values.
// Why: Journey 5 — admin authors diff, employee reviews before re-signing (ADR-0244).
//
// Layout: "side-by-side" (web, two panes) / "stacked" (mobile per ADR-0133).
// Colors: bg-rose-500/10 (removed/from) + bg-emerald-500/10 (added/to). No hardcoded tones.
// Motion: row highlight on mount uses motionTokens.enterMs / spring with useReducedMotion guard
//         (WCAG AAA requirement per ADR-0244 §AcknowledgementRing changes bullet 3).
//
// Driving ADR: ADR-0244, ADR-0133 (mobile web boundary — stacked on mobile).

"use client";

import { useReducedMotion } from "framer-motion";
import { AnimatePresence, motion } from "framer-motion";
import { motion as motionTokens } from "@smartout/design-tokens";

export interface DiffField {
  /** DB column name or human-readable label */
  label: string;
  /** Previous value (old contract). null → not set */
  previous: string | number | null;
  /** Proposed new value. null → not set */
  proposed: string | number | null;
}

export interface ContractAmendmentDiffProps {
  fields: DiffField[];
  /** "side-by-side" for web, "stacked" for mobile. Default "side-by-side". */
  layout?: "side-by-side" | "stacked";
}

function formatValue(v: string | number | null): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

export function ContractAmendmentDiff({
  fields,
  layout = "side-by-side",
}: ContractAmendmentDiffProps) {
  const prefersReduced = useReducedMotion();
  const stacked = layout === "stacked";

  const rowVariants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="border-border overflow-hidden rounded-xl border">
      {/* Column headers */}
      <div
        className={`border-border bg-muted text-muted-foreground grid border-b px-4 py-2 text-xs font-semibold tracking-wider uppercase ${
          stacked ? "grid-cols-1" : "grid-cols-3"
        }`}
      >
        <span>Felt</span>
        {!stacked && <span className="text-rose-500/80">Nåværende</span>}
        {!stacked && <span className="text-emerald-500/80">Forslag</span>}
      </div>

      <AnimatePresence initial={false}>
        {fields.map((field, idx) => {
          const changed = formatValue(field.previous) !== formatValue(field.proposed);
          return (
            <motion.div
              key={field.label}
              variants={rowVariants}
              initial="hidden"
              animate="visible"
              transition={{
                ...motionTokens.spring,
                delay: prefersReduced ? 0 : idx * 0.04,
              }}
              className={`border-border border-b last:border-0 ${changed ? "bg-background" : "bg-card"}`}
            >
              {stacked ? (
                /* Stacked layout (mobile) */
                <div className="space-y-1 px-4 py-3">
                  <p className="text-foreground text-xs font-semibold">{field.label}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-xs text-rose-700 line-through dark:text-rose-400">
                      {formatValue(field.previous)}
                    </span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {formatValue(field.proposed)}
                    </span>
                  </div>
                </div>
              ) : (
                /* Side-by-side layout (web) */
                <div className="divide-border grid grid-cols-3 divide-x">
                  <div className="px-4 py-3">
                    <p className="text-foreground text-xs font-semibold">{field.label}</p>
                  </div>
                  <div className="bg-rose-500/5 px-4 py-3">
                    <span
                      className={`text-sm ${changed ? "text-rose-700 line-through dark:text-rose-400" : "text-foreground"}`}
                    >
                      {formatValue(field.previous)}
                    </span>
                  </div>
                  <div className="bg-emerald-500/5 px-4 py-3">
                    <span
                      className={`text-sm font-medium ${changed ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}
                    >
                      {formatValue(field.proposed)}
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {fields.length === 0 && (
        <div className="text-muted-foreground px-4 py-6 text-center text-sm">
          Ingen feltendringer å vise.
        </div>
      )}
    </div>
  );
}
