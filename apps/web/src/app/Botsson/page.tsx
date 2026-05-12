"use client";

import { Suspense } from "react";
import { EntityDrawerProvider } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { BotssonPlayground } from "./_components/BotssonPlayground";

export default function BotssonPage() {
  return (
    // Suspense required — BotssonProvider and BotssonOrbVoiceMount call useSearchParams(),
    // which must be wrapped in a Suspense boundary for Next.js static prerender (CSR bailout).
    <Suspense>
      <EntityDrawerProvider>
        <BotssonPlayground />
      </EntityDrawerProvider>
    </Suspense>
  );
}
