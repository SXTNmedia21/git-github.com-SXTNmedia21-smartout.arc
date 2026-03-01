// ============================================
// page.tsx — Journey Detail (Platform Admin)
// Server component for a single journey's detail view.
// Fetches the journey, its steps, and event history in parallel,
// then passes everything to the client component for rendering.
// Connected to: apps/web/src/app/platform-admin/journeys/[id]/_components/journey-detail-client.tsx
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect, notFound } from "next/navigation";
import { JourneyDetailClient } from "./_components/journey-detail-client";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Platform-admin server page for a single journey.
 *
 * Why: Fetches journey + steps + events in parallel with the admin
 * client. Redirects non-godmode users. Returns 404 if journey not found.
 */
export default async function JourneyDetailPage({ params }: Props) {
  const { id } = await params;

  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  // Fetch journey, steps, and events in parallel
  const [journeyResult, stepsResult, eventsResult] = await Promise.all([
    admin.from("journey").select("*").eq("journey_id", id).single(),
    admin
      .from("journey_step")
      .select("*")
      .eq("journey_id", id)
      .order("step_order", { ascending: true }),
    admin
      .from("journey_event")
      .select("*")
      .eq("journey_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!journeyResult.data) {
    notFound();
  }

  return (
    <JourneyDetailClient
      journey={journeyResult.data}
      steps={stepsResult.data ?? []}
      events={eventsResult.data ?? []}
    />
  );
}
