"use client";

import type { TabKey } from "../season-page-client";

/**
 * Tab strip for the season detail page. Five tabs per spec §5.2.
 * Active tab underline uses the brand-orange token so the treatment
 * matches Nordic Split styling across light/dark themes.
 */
const TABS: readonly { key: TabKey; label: string }[] = [
  { key: "budget", label: "Budsjett" },
  { key: "day", label: "Dag" },
  { key: "hour", label: "Time" },
  { key: "hours", label: "Åpningstider" },
  { key: "overview", label: "Oversikt" },
];

type Props = {
  active: TabKey;
  onChange: (next: TabKey) => void;
};

export function SeasonSubmenu({ active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Sesongseksjoner" className="border-border flex gap-1 border-b">
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-controls={`season-tab-${tab.key}`}
            onClick={() => onChange(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[var(--brand-orange)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
