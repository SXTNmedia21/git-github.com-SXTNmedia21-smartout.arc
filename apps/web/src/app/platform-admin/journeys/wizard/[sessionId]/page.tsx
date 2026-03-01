// ============================================
// page.tsx — Wizard Session Page
// Server component that loads a wizard session by ID
// and passes it to the WizardChat client component.
// Connected to: wizard_session table
// Connected to: _components/wizard-chat.tsx (client component)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { WizardChat } from "./_components/wizard-chat";

type Props = { params: Promise<{ sessionId: string }> };

/**
 * Server page that loads a wizard session and renders the chat UI.
 *
 * Why server component: Fetches session data with admin client
 * before hydration. The chat component handles all client-side
 * interaction (sending messages, updating state).
 */
export default async function WizardSessionPage({ params }: Props) {
  const { sessionId } = await params;

  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("wizard_session")
    .select("*")
    .eq("wizard_session_id", sessionId)
    .single();

  if (!session) notFound();

  // Extract messages and draft from JSONB for type safety
  const messages = (session.messages as Array<{
    role: string;
    content: string;
    phase?: string;
    timestamp?: string;
  }>) ?? [];

  const draftJourney = (session.draft_journey as Record<string, unknown>) ?? {};

  return (
    <WizardChat
      sessionId={session.wizard_session_id}
      initialMessages={messages}
      initialPhase={session.current_phase}
      initialDraft={draftJourney}
      sessionStatus={session.status}
      journeyId={session.journey_id}
    />
  );
}
