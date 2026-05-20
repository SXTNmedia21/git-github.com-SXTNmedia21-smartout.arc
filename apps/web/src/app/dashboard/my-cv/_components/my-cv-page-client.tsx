/**
 * MyCvPageClient — client boundary for /dashboard/my-cv.
 *
 * Per ADR-0115 RSC migration pattern: the route's `page.tsx` is a Server
 * Component that handles the feature-flag redirect and wraps this single
 * client boundary in `<Suspense>`. The "Min CV" surface is currently a
 * placeholder while the CV / competence module is under development
 * (MY_CV feature flag). All future interactive CV state + queries will
 * live here.
 *
 * Botsson harness: MyCvToolsBridge is mounted unconditionally so Botsson
 * can answer "hva er CV-siden?" and explain the placeholder state even
 * before the module ships real data.
 */

"use client";

import { MyCvToolsBridge } from "../_tools/my-cv-tools-bridge";

export function MyCvPageClient() {
  return (
    <div className="py-12 text-center">
      {/* Botsson harness — 4 tools registered; isPlaceholder=true until module ships */}
      <MyCvToolsBridge
        isPlaceholder={true}
        loading={false}
        displayName={null}
        positionTitle={null}
        profileStatus={null}
        skills={[]}
        certifications={[]}
      />
      <h1 className="font-heading text-2xl">Min CV</h1>
      <p className="text-muted-foreground mt-2">Under utvikling</p>
    </div>
  );
}
