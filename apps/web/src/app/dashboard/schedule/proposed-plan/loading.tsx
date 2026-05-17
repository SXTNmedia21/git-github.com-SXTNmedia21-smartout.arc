/**
 * /dashboard/schedule/proposed-plan route-level loading skeleton.
 *
 * Mirrors ProposedPlanClient layout:
 *   - Page heading strip
 *   - Glass header card skeleton
 *   - Two action button skeletons
 */
export default function ProposedPlanLoading() {
  return (
    <div
      className="mx-auto flex max-w-2xl flex-col gap-8 p-4 md:p-6 lg:p-8"
      role="status"
      aria-live="polite"
      aria-label="Laster foreslått plan"
    >
      {/* Heading */}
      <div className="space-y-2">
        <div className="bg-muted/30 h-8 w-52 animate-pulse rounded-lg" />
        <div className="bg-muted/20 h-4 w-72 animate-pulse rounded-md" />
      </div>

      {/* Glass header card */}
      <div className="border-border/40 bg-muted/10 animate-pulse space-y-4 rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="bg-muted/30 h-7 w-44 rounded-lg" />
            <div className="bg-muted/20 h-4 w-60 rounded-md" />
          </div>
          <div className="bg-muted/20 h-7 w-16 rounded-full" />
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-border/30 bg-muted/10 h-20 rounded-xl border"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Shift list placeholder */}
      <div
        className="bg-muted/10 h-14 animate-pulse rounded-xl"
        style={{ animationDelay: "200ms" }}
      />

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <div
          className="bg-muted/20 h-11 w-full animate-pulse rounded-lg sm:w-28"
          style={{ animationDelay: "280ms" }}
        />
        <div
          className="bg-muted/30 h-11 w-full animate-pulse rounded-lg sm:w-48"
          style={{ animationDelay: "360ms" }}
        />
      </div>
    </div>
  );
}
