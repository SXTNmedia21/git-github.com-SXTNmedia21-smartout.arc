/**
 * /dashboard/help — Loading skeleton
 *
 * Mirrors the five-tier layout of page.tsx:
 *   Tier 0: PanicBar      — sticky 56px bar, 3 action buttons
 *   Tier 1: Botsson hero  — chat input area, capped 480px
 *   Tier 2: QuickPaths    — 2×2 grid of nav cards
 *   Tier 3: Articles list — 5 KB article rows
 *   Tier 5: Kontakt       — channel svartider footer
 *
 * Reduced-motion: shimmer guarded with motion-safe: so prefers-reduced-motion
 * users see a static skeleton with no animation.
 */

export default function HelpLoading() {
  return (
    <>
      {/* Tier 0: PanicBar skeleton — sticky 56px, 3 action buttons */}
      <div
        className="border-border bg-background/95 fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b px-4"
        aria-hidden="true"
      >
        {/* Left: label */}
        <div className="bg-muted h-4 w-20 rounded-md motion-safe:animate-pulse" />
        {/* Right: 3 action buttons */}
        <div className="flex gap-2">
          <div className="bg-muted h-9 w-24 rounded-md motion-safe:animate-pulse" />
          <div className="bg-muted h-9 w-24 rounded-md motion-safe:animate-pulse" />
          <div className="bg-muted h-9 w-24 rounded-md motion-safe:animate-pulse" />
        </div>
      </div>

      {/* Page content — single column, max-w-3xl centered, pt-20 clears PanicBar */}
      <main className="mx-auto w-full max-w-3xl space-y-10 px-4 pt-20 pb-16" aria-hidden="true">
        {/* Tier 1: Botsson Chat Hero skeleton */}
        <div className="border-border flex flex-col gap-4 rounded-xl border p-6">
          {/* Greeting */}
          <div className="bg-muted h-5 w-48 rounded-md motion-safe:animate-pulse" />
          {/* Sub-label */}
          <div className="bg-muted h-4 w-64 rounded-md motion-safe:animate-pulse" />
          {/* Chat input bar */}
          <div className="bg-muted mt-2 h-12 w-full rounded-lg motion-safe:animate-pulse" />
        </div>

        {/* Tier 2: QuickPath Cards — 2×2 grid */}
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-24 rounded-xl motion-safe:animate-pulse" />
          ))}
        </div>

        {/* Tier 3: CuratedArticlesList — section header + 5 rows */}
        <div className="flex flex-col gap-3">
          <div className="bg-muted h-5 w-36 rounded-md motion-safe:animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted h-10 w-full rounded-md motion-safe:animate-pulse" />
          ))}
        </div>

        {/* Tier 5: KontaktFooter — channel svartider rows */}
        <div className="border-border flex flex-col gap-3 rounded-xl border p-6">
          <div className="bg-muted h-5 w-28 rounded-md motion-safe:animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="bg-muted h-4 w-24 rounded-md motion-safe:animate-pulse" />
              <div className="bg-muted h-4 w-20 rounded-md motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
