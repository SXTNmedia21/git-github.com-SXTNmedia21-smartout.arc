"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChatClient } from "../_components/ChatClient";
import { useTranslation } from "@smartout/i18n";

export default function ChatPage() {
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("komm");

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("shell.loading_profile")}</p>
      </div>
    );
  }

  return <ChatClient profileId={profileId} />;
}
