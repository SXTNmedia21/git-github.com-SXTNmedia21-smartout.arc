// ============================================
// page.tsx — Wizard Launcher Page
// Server component that shows existing wizard sessions
// and provides a form to start a new one.
// Fetches workspaces (for selection) and recent sessions.
// Connected to: wizard_session table, workspace table
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WizardLauncherClient } from "./_components/wizard-launcher-client";

/**
 * Server page that loads workspaces and existing wizard sessions.
 *
 * Why server component: Fetches data with admin client (godmode-only page).
 * Passes data to the client component that handles session creation.
 */
export default async function WizardLauncherPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch workspaces and sessions in parallel
  const [{ data: workspaces }, { data: sessions }] = await Promise.all([
    admin.from("workspace").select("workspace_id, name, slug").eq("is_active", true).order("name"),
    admin
      .from("wizard_session")
      .select("wizard_session_id, status, current_phase, draft_journey, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return <WizardLauncherClient workspaces={workspaces ?? []} sessions={sessions ?? []} />;
}
