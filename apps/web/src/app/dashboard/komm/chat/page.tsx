import { Suspense } from "react";
import { ChatPageClient } from "../_components/chat-page-client";
import ChatLoading from "./loading";

/**
 * /dashboard/komm/chat — Server Component shell.
 * Single Suspense boundary wrapping a single client boundary per ADR-0115.
 * Mirrors the structure of /dashboard/komm/page.tsx — the client reads
 * `profileId` from `DashboardContext` and renders `ChatClient` (DM surface).
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPageClient />
    </Suspense>
  );
}
