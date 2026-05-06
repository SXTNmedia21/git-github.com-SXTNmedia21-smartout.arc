"use client";

import type { ComponentType, SVGProps } from "react";
import { cn } from "@smartout/ui";

export type PageTab<K extends string = string> = {
  key: K;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * PageTabNav — reports-style pill tab strip.
 *
 * Reusable across dashboard pages that need an in-page tab nav. Matches the
 * Reports-page tab visuals: `bg-muted/80` rail, active pill = `bg-background`
 * + soft shadow. Keyboard-accessible buttons (role="tab"). Caller owns state.
 *
 * `active` accepts either a tab key or a pathname; prefix-matching highlights
 * the right pill on nested routes (e.g. /dashboard/people/foo highlights /dashboard/people).
 */
export function PageTabNav<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
}: {
  tabs: ReadonlyArray<PageTab<K>>;
  active: K | string;
  onChange: (key: K) => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "border-border bg-muted/80 inline-flex h-auto w-fit gap-1 rounded-xl border p-1 shadow-sm",
        className,
      )}
    >
      {tabs.map((t) => {
        const isActive = t.key === active || String(active).startsWith(t.key + "/");
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${t.key}`}
            onClick={() => onChange(t.key)}
            className={cn(
              "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon ? <t.icon className="h-3.5 w-3.5" aria-hidden /> : null}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
