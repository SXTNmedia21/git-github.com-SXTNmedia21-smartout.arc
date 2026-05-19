"use client";

/**
 * /dashboard/hms layout — publishes a 6-tab PageTabNav to the dashboard
 * breadcrumb sub-header slot (Pontus annotation B). HmsSubNav.tsx is
 * deprecated — body-mounted nav was replaced 2026-05-19.
 */

import { useMemo } from "react";
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  FileText,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { PageTabNav, type PageTab } from "@/components/dashboard/PageTabNav";
import { usePageTabs } from "@/components/dashboard/PageHeaderContext";

const HMS_TAB_DEFS = [
  { key: "", label: "Oversikt", icon: LayoutDashboard },
  { key: "drift", label: "Drift", icon: ClipboardCheck },
  { key: "training", label: "Opplæring", icon: GraduationCap },
  { key: "documents", label: "Dokumenter", icon: FileText },
  { key: "deviations", label: "Avvik", icon: AlertTriangle },
  { key: "governance", label: "Governance", icon: ShieldCheck },
] as const satisfies ReadonlyArray<PageTab>;

const HMS_BASE_PATH = "/dashboard/hms";

export default function HmsLayout({ children }: { children: React.ReactNode }) {
  const tabsNode = useMemo(
    () => (
      <PageTabNav
        variant="route"
        tabs={HMS_TAB_DEFS}
        basePath={HMS_BASE_PATH}
        ariaLabel="HMS navigasjon"
      />
    ),
    [],
  );
  usePageTabs(tabsNode);

  return <div className="flex flex-1 flex-col overflow-y-auto">{children}</div>;
}
