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
import { unstable_cache } from "next/cache";
import { JourneyListClient } from "./_components/journey-list-client";

const getJourneysData = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data } = await admin.from("journey").select("*").order("code", { ascending: true });
    return data ?? [];
  },
  ["platform-admin-journeys-v1"],
  { revalidate: 60 },
);

export default async function JourneysPage() {
  const [adminId, journeys] = await Promise.all([getSuperAdminId(), getJourneysData()]);
  if (!adminId) redirect("/dashboard");

  return <JourneyListClient initialJourneys={journeys} />;
}
