"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { KommShell } from "./KommShell";

export function ChannelsPageClient() {
  const { profileId } = useContext(DashboardContext);

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Laster profil...</p>
      </div>
    );
  }

  return <KommShell profileId={profileId} />;
}
