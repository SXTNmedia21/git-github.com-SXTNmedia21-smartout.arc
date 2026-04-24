import { Building2, MapPin, Network, LayoutGrid } from "lucide-react";
import type { OrgTab } from "./types";

type TabDef = {
  id: OrgTab;
  label: string;
  icon: React.ElementType;
  countKey?: "departments" | "locations" | "teams";
};

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "departments", label: "Departments", icon: Building2, countKey: "departments" },
  { id: "locations", label: "Locations", icon: MapPin, countKey: "locations" },
  { id: "teams", label: "Teams", icon: Network, countKey: "teams" },
];

export function OrgTabNav({
  activeTab,
  onTabChange,
  counts,
  isDark,
}: {
  activeTab: OrgTab;
  onTabChange: (tab: OrgTab) => void;
  counts: { departments: number; locations: number; teams: number };
  isDark: boolean;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = tab.countKey ? counts[tab.countKey] : undefined;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-accent-foreground"
            }`}
          >
            <Icon className={`h-4 w-4 ${isActive ? "text-orange-500" : ""}`} />
            <span className="hidden sm:inline">{tab.label}</span>
            {count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? isDark
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-orange-100 text-orange-600"
                    : "bg-muted text-muted-foreground"
                }`}
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
