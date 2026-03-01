// ============================================
// page.tsx — Journey List (Platform Admin)
// Server component for the journey tracking portal.
// Fetches all journeys from the database and passes
// them to the client component for filtering, sorting,
// and pipeline visualization.
// Connected to: apps/web/src/app/platform-admin/journeys/_components/journey-list-client.tsx
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { JourneyListClient } from "./_components/journey-list-client";

/**
 * Platform-admin server page that loads all journeys.
 *
 * Why server component: Fetches data with the admin client
 * (service role) since journey data is platform-scoped.
 * Redirects non-godmode users to the dashboard.
 */
export default async function JourneysPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: journeys } = await admin
    .from("journey")
    .select("*")
    .order("code", { ascending: true });

  return <JourneyListClient initialJourneys={journeys ?? []} />;
}
