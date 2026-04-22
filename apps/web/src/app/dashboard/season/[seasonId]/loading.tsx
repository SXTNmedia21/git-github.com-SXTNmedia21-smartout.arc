/**
 * Loading skeleton for /dashboard/season/[seasonId].
 * Shown while the server component resolves dashboard context and
 * Suspense waits on the client shell's initial render.
 */
export default function SeasonPageLoading() {
  return (
    <div
      className="container mx-auto max-w-6xl px-6 py-8"
      aria-busy="true"
      aria-label="Laster sesong"
    >
      <div className="bg-muted mb-6 h-4 w-64 animate-pulse rounded" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-9 w-24 animate-pulse rounded-md" />
        ))}
      </div>
      <div className="bg-muted h-96 animate-pulse rounded-xl" />
    </div>
  );
}
