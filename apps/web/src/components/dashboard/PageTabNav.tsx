"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@smartout/ui";

export type PageTab<K extends string = string> = {
  key: K;
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
};

export type PageTabNavVariant = "pill" | "route";

/**
 * PageTabNav — canonical sub-tab primitive for the dashboard.
 *
 * variant="pill" (default): in-page tabs. Renders <button>; caller owns
 *   state via `active` + `onChange`. URL does not change.
 *
 * variant="route": URL-bound tabs. Renders <Link>; each tab's href is
 *   `${basePath}/${key}`. Active state is derived from usePathname().
 *   `onChange` is optional (fires before navigation for analytics).
 *
 * See docs/design/sitemap/web/00-CANONICAL.md §3.4 for usage rules.
 */
export function PageTabNav<K extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
  variant = "pill",
  basePath,
}: {
  tabs: ReadonlyArray<PageTab<K>>;
  active?: K | string;
  onChange?: (key: K) => void;
  ariaLabel?: string;
  className?: string;
  variant?: PageTabNavVariant;
  /** When variant="route", each tab links to `${basePath}/${key}`. Required when variant="route". */
  basePath?: string;
}) {
  const pathname = usePathname();

  if (variant === "route" && !basePath) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "PageTabNav: variant='route' requires basePath prop. Falling back to no-op render.",
      );
    }
    return null;
  }

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
        let isActive: boolean;
        let href: string | null = null;

        if (variant === "route" && basePath) {
          href = t.key === "" ? basePath : `${basePath}/${t.key}`;
          isActive = pathname === href || pathname.startsWith(href + "/");
        } else {
          isActive = t.key === active || String(active ?? "").startsWith(t.key + "/");
        }

        const inner = (
          <>
            {t.icon ? <t.icon className="h-3.5 w-3.5" aria-hidden /> : null}
            <span className="hidden sm:inline">{t.label}</span>
          </>
        );

        const tabClassName = cn(
          "focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:outline-none",
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        );

        const commonProps = {
          id: `tab-btn-${t.key}`,
          role: "tab" as const,
          "aria-selected": isActive,
          "aria-controls": `tab-panel-${t.key}`,
          className: tabClassName,
          "data-tab-key": t.key,
          "data-active": isActive ? "true" : "false",
        };

        if (variant === "route" && href) {
          return (
            <Link key={t.key} href={href} {...commonProps} onClick={() => onChange?.(t.key)}>
              {inner}
            </Link>
          );
        }

        return (
          <button key={t.key} type="button" {...commonProps} onClick={() => onChange?.(t.key)}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}
