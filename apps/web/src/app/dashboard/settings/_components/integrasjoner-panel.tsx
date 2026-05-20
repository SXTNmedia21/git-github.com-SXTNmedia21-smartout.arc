"use client";

/**
 * integrasjoner-panel.tsx
 *
 * Settings → Integrasjoner tab content.
 * POS Integrations tab is live data via TanStack Query.
 * Tripletex + SendGrid tabs are placeholders (Kommer snart).
 *
 * Data: TanStack Query hook — fetches pos_account rows client-side.
 *   (admin/pos-accounts/page.tsx uses a server component; this panel converts
 *    to a client fetch because Settings is a full client component tree — OD-4.)
 *
 * PosAccountsList is imported from admin/pos-accounts/_components/PosAccountsList.
 * No duplication of connect/disconnect logic.
 *
 * References:
 *   apps/web/src/app/dashboard/admin/pos-accounts/ (source surface)
 *   docs/design/sitemap/web/00-CANONICAL.md §2.2
 */

import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plug, Link2, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@smartout/ui";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { Skeleton } from "@/components/ui/skeleton";
import { PosAccountsList } from "../../admin/pos-accounts/_components/PosAccountsList";
import type { PosAccountRow } from "../../admin/pos-accounts/page";

/* ━━━ Inner tab types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type IntegrasjonerTab = "pos" | "tripletex" | "sendgrid";

type TabDef = {
  id: IntegrasjonerTab;
  label: string;
  icon: LucideIcon;
};

/* ━━━ Placeholder component (re-used pattern from settings-tabs.tsx) ━━━━━━━ */

function TabPlaceholder({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24">
      <div className="bg-muted mb-4 flex h-14 w-14 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground h-7 w-7" />
      </div>
      <h3 className="text-foreground mb-1 text-lg font-semibold">{label}</h3>
      <p className="text-muted-foreground text-sm">{t("settings_page.coming_soon")}</p>
    </div>
  );
}

/* ━━━ Loading skeleton ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function PosLoadingSkeleton() {
  return (
    <div className="space-y-4 p-1">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="space-y-3 pt-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}

/* ━━━ Main component ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

type IntegrasjonerPanelProps = {
  /**
   * Sub-tab to open on mount. Passed from settings-tabs.tsx switch so that
   * navigating directly to "tripletex" or "sendgrid" opens the correct tab.
   */
  initialTab?: IntegrasjonerTab;
};

export function IntegrasjonerPanel({ initialTab = "pos" }: IntegrasjonerPanelProps) {
  const { t } = useTranslation("dashboard");
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";
  // workspaceData doesn't expose is_active; gate behavior is upstream (admin RLS).
  const workspaceIsActive = Boolean(workspaceId);

  const [activeTab, setActiveTab] = useState<IntegrasjonerTab>(initialTab);

  const TABS: TabDef[] = [
    { id: "pos", label: t("settings_page.tabs.pos_integrasjoner"), icon: Plug },
    { id: "tripletex", label: t("settings_page.tabs.tripletex"), icon: Link2 },
    { id: "sendgrid", label: t("settings_page.tabs.sendgrid"), icon: Mail },
  ];

  // POS accounts — client-side TanStack Query (Settings is a full client component tree)
  const posQuery = useQuery({
    queryKey: ["pos-accounts", workspaceId],
    queryFn: async (): Promise<PosAccountRow[]> => {
      if (!workspaceId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("pos_account")
        .select("pos_account_id, vendor, external_account_id, status, last_synced_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) {
        // Fail open — return empty so list renders with the "connect" CTA.
        console.error("[integrasjoner-panel] pos_account fetch error:", error.message);
        return [];
      }
      return (data ?? []) as PosAccountRow[];
    },
    enabled: !!workspaceId && activeTab === "pos",
    staleTime: 2 * 60 * 1000, // 2 minutes — POS connections change infrequently
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* Inner pill-nav */}
      <div className="border-border bg-muted flex items-center gap-1 rounded-xl border p-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon
                className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")}
              />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex min-h-0 flex-1 flex-col pb-4">
        {activeTab === "pos" && (
          <>
            {posQuery.isLoading ? (
              <PosLoadingSkeleton />
            ) : (
              <PosAccountsList
                accounts={posQuery.data ?? []}
                workspaceId={workspaceId}
                workspaceIsActive={workspaceIsActive}
              />
            )}
          </>
        )}
        {activeTab === "tripletex" && (
          <TabPlaceholder icon={Link2} label={t("settings_page.tabs.tripletex")} />
        )}
        {activeTab === "sendgrid" && (
          <TabPlaceholder icon={Mail} label={t("settings_page.tabs.sendgrid")} />
        )}
      </div>
    </div>
  );
}
