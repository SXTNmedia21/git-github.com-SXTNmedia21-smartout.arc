import { Suspense } from "react";
import { VarslerClient } from "./_components/VarslerClient";
import VarslerLoading from "./loading";

/**
 * /dashboard/komm/varsler — Varsler tab in Kommunikasjon (SM-5).
 *
 * Mounts the same notification feed previously at /dashboard/notifications.
 * The old route now redirects here (307). Bell overlay's "Se alle →" button
 * has been updated to point here.
 *
 * Server Component shell → Suspense → client boundary (VarslerClient).
 * Mirrors ADR-0115 RSC migration pattern used across dashboard tabs.
 */
export default function VarslerPage() {
  return (
    <Suspense fallback={<VarslerLoading />}>
      <VarslerClient />
    </Suspense>
  );
}
