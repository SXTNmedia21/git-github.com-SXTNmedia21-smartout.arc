"use client";

import { useState } from "react";
import { Clock, Target, Building2, Bell, Users, Shield, type LucideIcon } from "lucide-react";
import { cn } from "@smartout/ui";
import { OpeningHoursSettings } from "./opening-hours-settings";

const TABS = [
  { id: "general", label: "General", icon: Building2 },
  { id: "hours", label: "Opening Hours", icon: Clock },
  { id: "kpis", label: "KPI Targets", icon: Target },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "teams", label: "Teams & Departments", icon: Users },
  { id: "security", label: "Security", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TabPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24">
      <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground h-7 w-7" />
      </div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">{label}</h3>
      <p className="text-muted-foreground text-sm">Coming soon</p>
    </div>
  );
}

function TabContent({ tabId }: { tabId: TabId }) {
  switch (tabId) {
    case "hours":
      return <OpeningHoursSettings />;
    default: {
      const tab = TABS.find((t) => t.id === tabId)!;
      return <TabPlaceholder icon={tab.icon} label={tab.label} />;
    }
  }
}

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabId>("hours");

  return (
    <div className="flex gap-6">
      {/* Left sidebar nav */}
      <nav className="w-56 shrink-0 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <TabContent tabId={activeTab} />
      </div>
    </div>
  );
}
