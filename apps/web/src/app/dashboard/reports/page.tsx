// ============================================
// reports/page.tsx
// AI-driven custom report builder page.
// Split-panel layout: saved reports + report viewer on the left,
// AI chat panel on the right. Users build reports through
// a guided conversation with Mr. Botsson.
// Connected to: _components/ReportsChatPanel.tsx (AI chat)
// Connected to: _components/SavedReportsGrid.tsx (saved reports grid)
// Connected to: _components/ReportViewer.tsx (data visualization)
// ============================================

import { ReportsPageShell } from "./_components/ReportsPageShell";
import { createClient } from "@smartout/supabase/server";
import { redirect } from "next/navigation";

/**
 * Server component that resolves auth + workspace context,
 * then renders the interactive client shell.
 */
export default async function ReportsPage() {
  const supabase = await createClient();

  // Auth check — redirect to login if not authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get workspace from user's profile (profile has both workspace_id and profile_id)
  const { data: profile } = await supabase
    .from("profile")
    .select("workspace_id, profile_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return <ReportsPageShell workspaceId={profile.workspace_id} />;
}
