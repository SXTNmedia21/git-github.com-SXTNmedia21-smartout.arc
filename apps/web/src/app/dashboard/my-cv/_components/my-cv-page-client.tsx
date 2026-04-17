/**
 * MyCvPageClient — client boundary for /dashboard/my-cv.
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that handles the feature-flag redirect and wraps this single
 * client boundary in `<Suspense>`. The "Min profil" surface is currently
 * a placeholder while the CV / competence module is under development
 * (MY_CV feature flag). All future interactive CV state + queries will
 * live here.
 */

"use client";

export function MyCvPageClient() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-2xl font-bold">Min profil</h1>
      <p className="text-muted-foreground mt-2">Under utvikling</p>
    </div>
  );
}
