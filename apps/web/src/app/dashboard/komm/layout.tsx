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

import { useTranslation } from "@smartout/i18n";
import { PageTabNav } from "@/components/dashboard/PageTabNav";
import { KOMM_TAB_DEFS, KOMM_BASE_PATH } from "./_lib/komm-tabs";
import type { PageTab } from "@/components/dashboard/PageTabNav";
import type { KommTabKey } from "./_lib/komm-tabs";

export default function KommLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation("komm");

  // Resolve translated labels at render time — PageTab requires label: string.
  const tabs: PageTab<KommTabKey>[] = KOMM_TAB_DEFS.map((def) => ({
    key: def.key,
    label: t(def.labelKey),
    icon: def.icon,
  }));

  return (
    <div className="flex flex-col">
      <div className="border-border border-b px-6 pt-4">
        <PageTabNav
          variant="route"
          tabs={tabs}
          basePath={KOMM_BASE_PATH}
          ariaLabel={t("shell.title")}
        />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
