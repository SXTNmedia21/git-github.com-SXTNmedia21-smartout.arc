"use client";

/**
 * ChatPageClient — client boundary for /dashboard/komm/chat (DM landing).
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that wraps this single client boundary in `<Suspense>` with
 * `chat/loading.tsx` as fallback.
 *
 * Reads `profileId` from `DashboardContext` (resolved by `DashboardShell`
 * in the dashboard layout) and hands off to `ChatClient`, which owns
 * the full DM list + message surface. Mirrors `komm-page-client.tsx`.
 */

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ChatClient } from "./ChatClient";
import { useTranslation } from "@smartout/i18n";
import { DomainChatOwnership } from "@/app/Botsson/_components/DomainChatOwnership";

export function ChatPageClient() {
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("komm");

  if (!profileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">{t("shell.loading_profile")}</p>
      </div>
    );
  }

  return (
    <>
      {/* ADR-0238: /dashboard/komm/chat owns the DM chat surface — Orb suppresses to passive. */}
      <DomainChatOwnership reason="komm-chat" />
      <ChatClient profileId={profileId} />
    </>
  );
}
