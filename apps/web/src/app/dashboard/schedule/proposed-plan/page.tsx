import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@smartout/supabase/server";
import { ProposedPlanClient } from "./_components/ProposedPlanClient";
import ProposedPlanLoading from "./loading";

/**
 * /dashboard/schedule/proposed-plan — Server Component shell.
 *
 * Confirms auth server-side before rendering the client island.
 * Manager+ only (role enforced in BFF; avoids double DB query per ADR-0115).
 *
 * The client island fetches pending change_proposal rows with
 * kind='scheduler_bundle' via GET /api/scheduler/proposals and
 * presents the atomic-accept review UI per ADR-0309.
 *
 * ADR references:
 *   ADR-0021  (server + client split — server gates auth, client fetches data)
 *   ADR-0309  (scheduler bundle atomic accept V1)
 *   ADR-0151  (identity server-derived; BFF enforces)
 */
export const metadata = {
  title: "Foreslått plan — Smartout",
  description: "Gjennomgå og godta eller avvis planleggerens forslag.",
};

export default async function ProposedPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Role enforcement delegated to BFF (GET /api/scheduler/proposals returns 403 for non-managers).
  // Avoids double DB query per ADR-0115 RSC migration pattern.

  return (
    <Suspense fallback={<ProposedPlanLoading />}>
      <ProposedPlanClient />
    </Suspense>
  );
}
