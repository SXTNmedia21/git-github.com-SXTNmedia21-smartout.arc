"use client";

/**
 * PageTabNav — pill-row tab navigation shared across People-module pages.
 *
 * Renders a horizontal strip of pill-style tab buttons. The `active` prop
 * accepts the current pathname (or the key of the active tab); pills whose
 * `key` matches are highlighted with brand-orange. Clicking a pill calls
 * `onChange` with the href so the parent can push the route.
 *
 * Used by: PeoplePageClient, PoliciesPageClient, ContractsPage, and the
 * PeopleInvitationsTabNav client island.
 */

import type { ComponentType, SVGProps } from "react";

type TabItem = {
  key: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

type PageTabNavProps = {
  tabs: TabItem[];
  /** Current pathname or tab key — used to determine the active pill. */
  active: string;
  onChange: (href: string) => void;
  ariaLabel?: string;
};

export function PageTabNav({ tabs, active, onChange, ariaLabel }: PageTabNavProps) {
  return (
    <nav
      aria-label={ariaLabel ?? "Page sections"}
      className="flex items-center gap-1 overflow-x-auto pb-0.5"
    >
      {tabs.map((tab) => {
        // Match: active path starts with tab key (handles nested routes),
        // or is an exact match. Longest-key-first ordering prevents false
        // positives when tab keys are prefixes of each other.
        const isActive = active === tab.key || active.startsWith(tab.key + "/");
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? "bg-brand-orange/15 text-brand-orange ring-brand-orange/30 shadow-[0_0_16px_-4px_oklch(0.78_0.18_55_/_0.3)] ring-1"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${isActive ? "" : "opacity-60"}`} aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
