"use client";

/**
 * /dashboard/komm layout — Kommunikasjon umbrella shell (SM-5).
 *
 * Renders a four-tab PageTabNav (Kanaler · Skranke · Nyheter · Varsler) above
 * every /dashboard/komm/* child route. Active tab is URL-derived via
 * PageTabNav variant="route" + usePathname() inside the component.
 *
 * Must be a client component to call useTranslation — PageTabNav expects
 * already-resolved `label` strings, not i18n keys.
 *
 * Kanaler tab: key="" maps to basePath ("/dashboard/komm") — no sub-segment.
 * The existing /dashboard/komm/page.tsx continues to serve the Kanaler surface
 * unchanged; no new /komm/kanaler route is created.
 */

import { useMemo } from "react";
import { useTranslation } from "@smartout/i18n";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { usePageTabs } from "@/components/dashboard/PageHeaderContext";
import { KOMM_TAB_DEFS, KOMM_BASE_PATH } from "./_lib/komm-tabs";
import type { PageTab } from "@/components/dashboard/PageTabNav";
import type { KommTabKey } from "./_lib/komm-tabs";

export default function KommLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("komm");

  const tabsNode = useMemo(() => {
    const tabs: PageTab<KommTabKey>[] = KOMM_TAB_DEFS.map((def) => ({
      key: def.key,
      label: t(def.labelKey),
      icon: def.icon,
    }));
    return (
      <PageTabNav
        variant="route"
        tabs={tabs}
        basePath={KOMM_BASE_PATH}
        ariaLabel={t("shell.title")}
      />
    );
  }, [t]);
  usePageTabs(tabsNode);

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
