"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Top bar: Back + Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className={`rounded-lg border p-2 transition-colors ${
            isDark
              ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
              : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <nav className="flex items-center gap-1.5">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight className={`h-3 w-3 ${isDark ? "text-zinc-600" : "text-zinc-400"}`} />
              )}
              {crumb.href ? (
                <button
                  onClick={() => router.push(crumb.href!)}
                  className={`text-xs font-medium transition-colors ${
                    isDark
                      ? "text-zinc-500 hover:text-zinc-300"
                      : "text-zinc-400 hover:text-zinc-700"
                  }`}
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  className={`text-xs font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                >
                  {crumb.label}
                </span>
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
            <h1
              className={`text-2xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              {name}
            </h1>
            {badges && <div className="mt-1.5 flex items-center gap-2">{badges}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab ?? tabs[0]?.value} className="flex min-h-0 flex-1 flex-col">
        <TabsList
          className={`h-auto justify-start gap-1 rounded-xl border p-1 ${
            isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"
          }`}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all data-[state=active]:shadow-sm ${
                isDark
                  ? "text-zinc-500 data-[state=active]:bg-zinc-800 data-[state=active]:text-white"
                  : "text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-zinc-900"
              }`}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

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
