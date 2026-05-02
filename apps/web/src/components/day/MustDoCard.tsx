"use client";

import { AlertTriangle, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@smartout/ui";

export type MustDoItem = {
  id: string;
  /** Display title — bold first line. */
  title: string;
  /** Smaller secondary line. */
  subtitle?: string;
  /** Optional icon override. Defaults to `AlertTriangle`. */
  icon?: LucideIcon;
  /** Click handler — typically opens a drawer or navigates. */
  onAction?: () => void;
};

/**
 * MustDoCard — bold red "must-do" surface that floats at the top of any tab
 * where mandatory work is queued. Aggregates open critical deviations,
 * pending reconciliations, contracts awaiting signature, etc.
 *
 * Hides itself when there are no items (parent passes empty array).
 */
export function MustDoCard({
  items,
  title = "Må gjøres nå",
  description,
}: {
  items: MustDoItem[];
  title?: string;
  description?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-rose-300/50 bg-gradient-to-br from-rose-50 via-rose-50/80 to-orange-50 shadow-md dark:border-rose-500/30 dark:from-rose-500/10 dark:via-rose-500/5 dark:to-orange-500/10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-rose-500/30 blur-3xl dark:bg-rose-500/20"
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col p-5">
        <div className="mb-3 flex shrink-0 items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-rose-300 bg-rose-100 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-[0.14em] tracking-tight text-rose-700 uppercase dark:text-rose-200">
              {title}
            </h3>
            <p className="mt-0.5 text-[12px] text-rose-700/80 dark:text-rose-200/70">
              {description ??
                `${items.length} sak${items.length === 1 ? "" : "er"} krever handling`}
            </p>
          </div>
        </div>

        <ul className="scrollbar-thin grid min-h-0 flex-1 gap-1.5 overflow-y-auto pr-1">
          {items.map((it) => {
            const Icon = it.icon ?? AlertTriangle;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={it.onAction}
                  disabled={!it.onAction}
                  className={cn(
                    "group flex w-full items-center gap-3 rounded-xl border border-rose-200/70 bg-white/70 px-3 py-2.5 text-left shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:bg-white hover:shadow-md",
                    "focus-visible:ring-2 focus-visible:ring-rose-500/50 focus-visible:outline-none",
                    "dark:border-rose-500/20 dark:bg-rose-500/5 dark:hover:bg-rose-500/10",
                    !it.onAction && "cursor-default opacity-80 hover:transform-none",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-rose-900 dark:text-rose-100">
                      {it.title}
                    </span>
                    {it.subtitle ? (
                      <span className="block truncate text-[11px] text-rose-700/70 dark:text-rose-200/60">
                        {it.subtitle}
                      </span>
                    ) : null}
                  </span>
                  {it.onAction ? (
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-rose-500/70 transition-transform group-hover:translate-x-0.5 dark:text-rose-300/70"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
