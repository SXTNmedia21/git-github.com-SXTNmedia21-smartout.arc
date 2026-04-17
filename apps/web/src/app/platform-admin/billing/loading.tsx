// Billing loading skeleton. Uses Nordic Split semantic tokens only
// (bg-muted + bg-card + border-border) so it aligns with the Phase 5.2
// ESLint fence and the InvoiceStatusBadge component.

export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted/50 h-8 w-32 animate-pulse rounded-lg" />
        <div className="bg-muted/30 mt-1 h-4 w-64 animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border-border/50 bg-card/50 h-28 animate-pulse rounded-xl border"
          />
        ))}
      </div>
      <div className="border-border/50 bg-card/50 h-[260px] animate-pulse rounded-xl border" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
