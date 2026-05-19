"use client";

/**
 * struktur-tab-nav.tsx
 *
 * Inner pill-nav for the four Struktur sub-tabs inside the Settings → Struktur panel.
 * Mirrors org-tab-nav.tsx styling but is embedded inside the settings content area.
 *
 * Key differences from org-tab-nav:
 *   - No isDark prop — settings panels use CSS variables (ADR-0366, Nordic Split).
 *   - No hardcoded colours (no OKLCH literals, no zinc-/slate-/gray- classes).
 *   - Badge uses semantic vars: bg-primary/10 text-primary (active),
 *     bg-muted text-muted-foreground (inactive).
 *
 * References:
 *   apps/web/src/app/dashboard/organization/_components/org-tab-nav.tsx (source styling)
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2 (Struktur tab order)
 */

import { Building2, MapPin, Network, LayoutGrid } from "lucide-react";
import { cn } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import type { OrgTab } from "../../organization/_components/types";

type TabDef = {
  id: OrgTab;
  labelKey: string;
  icon: React.ElementType;
  countKey?: "departments" | "locations" | "teams";
};

const TABS: TabDef[] = [
  { id: "overview", labelKey: "settings_page.tabs.struktur_overview", icon: LayoutGrid },
  {
    id: "departments",
    labelKey: "settings_page.tabs.avdelinger",
    icon: Building2,
    countKey: "departments",
  },
  {
    id: "locations",
    labelKey: "settings_page.tabs.lokasjoner",
    icon: MapPin,
    countKey: "locations",
  },
  { id: "teams", labelKey: "settings_page.tabs.team", icon: Network, countKey: "teams" },
];

type StrukturTabNavProps = {
  activeTab: OrgTab;
  onTabChange: (tab: OrgTab) => void;
  counts: { departments: number; locations: number; teams: number };
};

export function StrukturTabNav({ activeTab, onTabChange, counts }: StrukturTabNavProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="border-border bg-muted flex items-center gap-1 rounded-xl border p-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = tab.countKey ? counts[tab.countKey] : undefined;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
