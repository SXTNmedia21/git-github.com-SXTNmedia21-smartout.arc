/**
 * KommPageClient — client boundary for /dashboard/komm (channels landing).
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that wraps this single client boundary in `<Suspense>`.
 *
 * Reads `profileId` from `DashboardContext` (resolved by `DashboardShell`
 * in the dashboard layout) and hands off to `KanalerClient`, which owns
 * the full channel list + message surface. Shows a small shell while
 * the profile resolves — matches the pattern used by the `/komm/{chat,
 * nyheter, oversikt}` subroutes.
 */

"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { KanalerClient } from "./KanalerClient";
import { useTranslation } from "@smartout/i18n";

export function KommPageClient() {
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("komm");

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("shell.loading_profile")}</p>
      </div>
    );
  }

  return <KanalerClient profileId={profileId} />;
}
