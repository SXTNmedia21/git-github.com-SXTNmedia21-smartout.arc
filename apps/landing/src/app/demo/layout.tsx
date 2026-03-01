// ============================================
// layout.tsx
// Minimal layout for the /demo route.
// No landing navigation — clean demo environment
// so visitors focus on the product experience.
// Connected to: app/demo/page.tsx, app/demo/[journey]/page.tsx
// ============================================

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Interaktiv Demo — Smartout",
  description:
    "Opplev Smartout gjennom 6 guidede scenarier. Se hvordan AI-assistenten Lise hjelper ansatte og ledere i hverdagen.",
};

/**
 * Minimal wrapper — no nav, no footer, just the demo content.
 *
 * Why no navigation: The demo is an immersive experience where
 * we want the visitor's full attention on the product UI and
 * the AI assistant. A back button inside each page provides
 * the escape hatch.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
