// ============================================
// VariantSLanding.tsx
// Landing page variant S — "Eleganse" style.
// Placeholder stub — to be fully designed later.
// Connected to: app/page.tsx (variant switcher)
// ============================================

"use client";

import Navigation from "../navigation";
import Footer from "../footer";

/**
 * Elegant landing variant — "Raffinert håndverk".
 * Currently renders a placeholder with navigation and footer
 * to satisfy the variant switcher without breaking builds.
 */
export default function VariantSLanding() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-950 font-sans text-white">
      <Navigation />
      <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-32 pb-20">
        <span className="mb-4 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-bold tracking-wider text-rose-400 uppercase">
          Eleganse
        </span>
        <h1 className="mb-4 text-center text-4xl font-bold tracking-tight">
          Variant S — Under utvikling
        </h1>
        <p className="max-w-md text-center text-white/50">
          Denne varianten er under utvikling. Bytt til en annen variant i bunnteksten.
        </p>
      </main>
      <Footer />
    </div>
  );
}
