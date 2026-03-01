// ============================================
// VariantTLanding.tsx
// Landing page variant T — "Enterprise" style.
// Placeholder stub — to be fully designed later.
// Connected to: app/page.tsx (variant switcher)
// ============================================

"use client";

import Navigation from "../navigation";
import Footer from "../footer";

/**
 * Enterprise landing variant — "Data og kontroll".
 * Currently renders a placeholder with navigation and footer
 * to satisfy the variant switcher without breaking builds.
 */
export default function VariantTLanding() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white">
      <Navigation />
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-32 pb-20">
        <span className="mb-4 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold tracking-wider text-blue-400 uppercase">
          Enterprise
        </span>
        <h1 className="mb-4 text-center text-4xl font-bold tracking-tight">
          Variant T — Under utvikling
        </h1>
        <p className="max-w-md text-center text-white/50">
          Denne varianten er under utvikling. Bytt til en annen variant i bunnteksten.
        </p>
      </main>
      <Footer />
    </div>
  );
}
