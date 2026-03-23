// ============================================
// layout.tsx
// Route-level metadata for the competitor
// comparison page.
//
// Why: this page lives alongside the free-forever
// campaign and proves Smartout Free beats paid
// competitors — it needs its own SEO metadata.
// ============================================

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Smartout vs konkurrentene — se hva du faktisk får gratis",
  description:
    "Sammenlign Smartout Free mot Planday, 7shifts, Homebase, When I Work og Fork. Se hva andre tar betalt for — og hva Smartout gir deg gratis.",
};

/**
 * CompareLayout wraps the comparison route with SEO metadata.
 * Why: the page owns its full visual shell, so this layout stays minimal.
 *
 * @returns Children unchanged.
 */
export default function CompareLayout({ children }: { children: ReactNode }) {
  return children;
}
