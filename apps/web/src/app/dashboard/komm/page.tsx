import { Suspense } from "react";
import { KommPageClient } from "./_components/komm-page-client";
import ChannelsLoading from "./loading";

/**
 * /dashboard/komm — Server Component shell.
 * Single Suspense boundary wrapping a single client boundary per ADR-0115.
 * The client reads `profileId` from `DashboardContext` (layout-resolved)
 * and renders the KanalerClient channel surface.
 */
export default function KommPage() {
  return (
    <Suspense fallback={<ChannelsLoading />}>
      <KommPageClient />
    </Suspense>
  );
}
