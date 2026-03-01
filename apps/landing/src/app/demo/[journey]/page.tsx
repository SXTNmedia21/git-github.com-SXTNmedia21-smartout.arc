// ============================================
// [journey]/page.tsx
// Dynamic route for individual guided demo journeys.
// Reads the journey ID from the URL, looks it up in the
// registry, and renders the DemoShell with the matching config.
// 404 (notFound) for unknown journey IDs.
// Connected to: components/demo/DemoShell.tsx,
//   components/demo/journeys/index.ts (registry)
// ============================================

"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { journeyMap } from "../../../components/demo/journeys";
import { DemoShell } from "../../../components/demo/DemoShell";

type PageProps = {
  params: Promise<{ journey: string }>;
};

/**
 * Renders the demo shell for a specific journey.
 *
 * Why client component: The DemoShell uses hooks (useDemoJourney)
 * and Framer Motion for the interactive experience.
 * We use React 19's `use()` to unwrap the params promise.
 */
export default function JourneyPage({ params }: PageProps) {
  const { journey } = use(params);
  const config = journeyMap.get(journey);

  // Unknown journey ID → 404
  if (!config) {
    notFound();
  }

  return <DemoShell config={config} />;
}
