import { Suspense } from "react";
import { ChatPageClient } from "@/app/dashboard/komm/_components/chat-page-client";
import ChatLoading from "./loading";

/**
 * /dashboard/chat — Standalone top-level Chat route (SM-5).
 *
 * DM + group messaging surface. Promoted from /dashboard/komm/chat to
 * a top-level sidebar slot per canonical spec §2 + §3.
 *
 * Delegates to the same <ChatPageClient> used by /dashboard/komm/chat so
 * the DM surface is identical on both routes. <DomainChatOwnership> is
 * declared inside ChatPageClient — each route that mounts it gets its
 * own ownership declaration (ADR-0238), which is correct: both routes
 * independently suppress the Botsson Orb to passive mode.
 *
 * The /dashboard/komm/chat route is kept alive for backward compatibility —
 * any saved bookmarks or notification action_url values pointing there
 * continue to work. No redirect needed.
 */
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatPageClient />
    </Suspense>
  );
}
