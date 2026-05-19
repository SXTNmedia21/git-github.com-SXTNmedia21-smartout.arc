import { SkeletonCard, SkeletonHeading, SkeletonLine } from "@smartout/ui";

/**
 * /dashboard/setup route-level loading skeleton.
 *
 * Mirrors the AnimatedWizardShell two-column layout:
 *   - Left brand panel (dark, 380px) with step-dot indicator row
 *   - Right content area:
 *       - Top progress bar (step tabs)
 *       - Scrollable form body (header + 3-field skeleton)
 *       - Bottom nav bar (Back / Next buttons)
 *
 * Prevents layout shift on Suspense resolution — skeleton dimensions
 * match the actual wizard shell frame so no reflow occurs.
 */
export default function SetupLoading() {
  return (
    <div
      className="relative flex min-h-[100dvh]"
      role="status"
      aria-live="polite"
      aria-label="Laster oppsettveiviser"
    >
      {/* ── Left brand panel skeleton ───────────────────────────────────── */}
      <div className="bg-muted/20 relative hidden w-[380px] shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex xl:w-[440px]">
        {/* Ambient glow blobs */}
        <div className="bg-brand-orange/10 absolute -top-[20%] left-[20%] h-[50vh] w-[50vh] rounded-full blur-[130px]" />
        <div className="bg-brand-orange/8 absolute right-[10%] -bottom-[10%] h-[40vh] w-[40vh] rounded-full blur-[110px]" />

        {/* Logo placeholder */}
        <div>
          <SkeletonLine className="mb-2 h-7 w-28 rounded-md" />
        </div>

        {/* Brand copy placeholder */}
        <div className="max-w-[320px] space-y-3">
          <SkeletonHeading className="h-10 w-4/5" />
          <SkeletonHeading className="h-8 w-3/5" />
          <SkeletonLine className="mt-4 h-4 w-full" />
          <SkeletonLine className="h-4 w-4/5" />
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`bg-brand-orange rounded-full transition-[width,height,opacity] ${
                i === 0 ? "h-1.5 w-6 opacity-80" : "h-1 w-1 opacity-20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Right content area ──────────────────────────────────────────── */}
      <div className="relative flex w-full flex-1 flex-col overflow-hidden">
        {/* Progress bar / step tabs */}
        <div className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4 lg:px-8">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonLine
              key={i}
              className={`h-2 rounded-full ${i === 0 ? "w-16 opacity-80" : "w-8 opacity-30"}`}
            />
          ))}
        </div>

        {/* Step form body */}
        <main className="flex-1 overflow-y-auto px-4 pt-4 pb-4 lg:px-8 xl:px-12">
          <div className="mx-auto w-full max-w-2xl px-8 py-12">
            {/* Step counter + subtitle */}
            <SkeletonLine className="mb-3 h-3 w-40" />

            {/* Step title */}
            <SkeletonHeading className="mb-3 h-9 w-3/4" />

            {/* Explanation */}
            <SkeletonLine className="mb-2 h-4 w-full" />
            <SkeletonLine className="mb-8 h-4 w-2/3" />

            {/* Form fields */}
            <SkeletonCard className="space-y-5 p-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonLine className="h-3.5 w-28" />
                  <SkeletonLine className="h-10 w-full rounded-md" />
                </div>
              ))}
            </SkeletonCard>
          </div>
        </main>

        {/* Bottom nav bar */}
        <div className="border-border flex shrink-0 items-center justify-between border-t px-8 py-4">
          <SkeletonLine className="h-10 w-24 rounded-lg opacity-50" />
          <SkeletonLine className="h-10 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
