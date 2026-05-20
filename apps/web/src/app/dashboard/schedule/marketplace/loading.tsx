/**
 * /dashboard/schedule/marketplace route-level loading skeleton.
 *
 * Mirrors MarketplacePageClient layout:
 *   - Page heading strip
 *   - Tab bar (3 tabs)
 *   - 3 skeleton offer cards
 */
export default function MarketplaceLoading() {
  return (
    <div
      className="flex h-full flex-col gap-6 p-4 md:p-6 lg:p-8"
      role="status"
      aria-live="polite"
      aria-label="Laster vakt-markedsplass"
    >
      {/* Heading */}
      <div className="flex items-center gap-3">
        <div className="bg-muted/30 h-6 w-6 animate-pulse rounded-md" />
        <div className="bg-muted/30 h-7 w-48 animate-pulse rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="border-border/40 flex gap-1 rounded-xl border p-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-muted/20 h-9 flex-1 animate-pulse rounded-lg"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>

      {/* Offer cards */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border-border/40 bg-muted/10 h-20 animate-pulse rounded-xl border"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
