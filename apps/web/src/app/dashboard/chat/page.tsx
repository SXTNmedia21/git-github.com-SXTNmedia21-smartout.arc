"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChatShell } from "./_components/ChatShell";

/**
 * Chat page — communications portal.
 * Design: docs/plans/2026-03-20-chat-communications-portal-design.md
 */
export default function ChatPage() {
  const { profileId } = useContext(DashboardContext);

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Laster profil...</p>
      </div>
    );
  }

  return <ChatShell profileId={profileId} />;
}
