"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageTabNav } from "@/components/dashboard/PageTabNav";

type Breadcrumb = {
  label: string;
  href?: string;
};

type TabDef = {
  value: string;
  label: string;
  content: ReactNode;
};

type EntityDetailLayoutProps = {
  breadcrumbs: Breadcrumb[];
  name: string;
  color?: string | null;
  icon?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
  tabs: TabDef[];
  defaultTab?: string;
};

export function EntityDetailLayout({
  breadcrumbs,
  name,
  color,
  icon,
  badges,
  actions,
  tabs,
  defaultTab,
}: EntityDetailLayoutProps) {
  const router = useRouter();
  const { isDark } = useContext(DashboardContext);
  const [activeTab, setActiveTab] = useState<string>(defaultTab ?? tabs[0]?.value ?? "");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Top bar: Back + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg border p-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <nav className="flex items-center gap-1.5">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="text-muted-foreground h-3 w-3" />}
              {crumb.href ? (
                <button
                  onClick={() => router.push(crumb.href!)}
                  className="text-muted-foreground hover:text-accent-foreground text-xs font-medium transition-colors"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-foreground text-xs font-medium">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      {/* Entity Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* Color accent / icon */}
          {icon ? (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={color ? { backgroundColor: `${color}15` } : undefined}
            >
              {icon}
            </div>
          ) : color ? (
            <div
              className="h-4 w-4 rounded-full ring-2 ring-offset-2"
              style={{
                backgroundColor: color,
                ["--tw-ring-color" as string]: color,
                ["--tw-ring-offset-color" as string]: isDark ? "#09090b" : "#ffffff",
              }}
            />
          ) : null}

          <div>
            <h1 className="text-foreground text-2xl font-extrabold tracking-tight">{name}</h1>
            {badges && <div className="mt-1.5 flex items-center gap-2">{badges}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <PageTabNav
          tabs={tabs.map((t) => ({ key: t.value, label: t.label }))}
          active={activeTab}
          onChange={(v) => setActiveTab(v)}
          className="mb-5"
          ariaLabel="Detalj-seksjoner"
        />

        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="hide-scrollbar mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto pb-4"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
