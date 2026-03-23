// ============================================
// layout.tsx
// Route-level metadata for the free-forever
// pricing campaign.
//
// Why: the campaign has a distinct value
// proposition and should be shareable on its
// own subdomain with focused metadata.
// ============================================

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Smartout er gratis — free4ever.smartout.ai",
  description:
    "Smartout Core er gratis. Slå på Premium, Pro eller Enterprise når du vil ha AI, automasjon og bedre nettsider.",
};

/**
 * FreeForeverLayout wraps the campaign route with route-specific metadata only.
 * Why: the page already owns its full visual shell, so this layout stays minimal.
 *
 * @returns The campaign children unchanged.
 */
export default function FreeForeverLayout({ children }: { children: ReactNode }) {
  return children;
}
