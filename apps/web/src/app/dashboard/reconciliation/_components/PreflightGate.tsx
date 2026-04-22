"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PreflightGate — visual invariants per Frontend Council 2026-04-20:
 *   - Blocker list: border-l-4 border-destructive (not full border — 40% reduction)
 *   - Each row focus-visible ring + role=button
 *   - Click-to-jump uses scrollIntoView({ behavior: 'smooth', block: 'center' })
 *   - Exit motion when blockers=0: spring 35/24/2.3, min 400ms, unfold-with-opacity
 *   - `useReducedMotion` fallback to crossfade
 *
 * Campaign Invariant #13 (no blockers, always navigable):
 *   - `overrideSlot` renders an action (e.g. AdminOverrideDialog trigger) on
 *     the right side of the blocker header. Override is a PEER CTA to
 *     approve — not an escape hatch buried in the aside panel.
 *
 * Content model: caller passes list of blockers with optional tab-jump targets
 * plus an optional `overrideSlot` for peer actions.
 */

export type PreflightBlocker = {
  id: string;
  text: string;
  hint?: string;
  /**
   * Tab key to select when user clicks this row. Parent recon-detail component
   * listens to `onJump` and switches tabs + scrolls within the target tab.
   */
  tab?: string;
};

type Props = {
  blockers: PreflightBlocker[];
  onJump?: (tab: string, blockerId: string) => void;
  /**
   * Optional inline override CTA rendered on the right side of the blocker
   * header. Caller provides the node (typically an AdminOverrideDialog
   * trigger). Campaign Invariant #13 — override must be visible peer of
   * approve, not escape-modal buried in aside.
   */
  overrideSlot?: React.ReactNode;
};

export function PreflightGate({ blockers, onJump, overrideSlot }: Props) {
  const reduceMotion = useReducedMotion();
  const isClear = blockers.length === 0;

  const springConfig = reduceMotion
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 35, damping: 24, mass: 2.3 };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {isClear ? (
        <motion.div
          key="clear"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={springConfig}
          className="border-success/30 flex items-center gap-3 rounded-xl border bg-[color:color-mix(in_oklch,var(--success)_6%,var(--card))] p-4"
          role="status"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--success)]" aria-hidden />
          <div>
            <p className="text-foreground text-sm font-semibold">Klar for godkjenning</p>
            <p className="text-muted-foreground text-xs">
              Ingen åpne blokkere. Bekreft på høyre panel.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="blocked"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
          animate={{ opacity: 1, height: "auto", y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }}
          transition={springConfig}
          className="overflow-hidden rounded-xl border-l-4 border-[color:var(--destructive)] bg-[color:color-mix(in_oklch,var(--destructive)_6%,var(--card))]"
        >
          <div className="border-b border-[color:color-mix(in_oklch,var(--destructive)_15%,transparent)] px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <AlertCircle
                  className="h-5 w-5 shrink-0 text-[color:var(--destructive)]"
                  aria-hidden
                />
                <p className="text-foreground text-sm font-semibold">
                  {blockers.length} {blockers.length === 1 ? "punkt" : "punkter"} må løses før
                  godkjenning
                </p>
              </div>
              {overrideSlot && <div className="shrink-0">{overrideSlot}</div>}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Klikk på et punkt for å hoppe til riktig sted.
            </p>
          </div>
          <ul className="divide-border divide-y">
            {blockers.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => b.tab && onJump?.(b.tab, b.id)}
                  className={cn(
                    "hover:bg-muted/30 focus-visible:ring-ring group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                    !b.tab && "cursor-default",
                  )}
                  aria-label={`Blokker: ${b.text}. Trykk for å åpne seksjon.`}
                >
                  <AlertCircle
                    className="h-4 w-4 shrink-0 text-[color:var(--warning)]"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-medium">{b.text}</p>
                    {b.hint && <p className="text-muted-foreground text-xs">{b.hint}</p>}
                  </div>
                  {b.tab && (
                    <ChevronRight
                      className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition-colors"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
