"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { KommShell } from "./KommShell";
import { useTranslation } from "@smartout/i18n";

export function ChannelsPageClient() {
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("komm");

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("shell.loading_profile")}</p>
      </div>
    );
  }

  return <KommShell profileId={profileId} />;
}
