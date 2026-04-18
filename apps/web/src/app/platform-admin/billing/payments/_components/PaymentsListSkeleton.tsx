// Nordic Split skeleton for the platform-admin payments dashboard.
// Mirrors IntegrationsListSkeleton structure so the Suspense handoff
// doesn't flicker. Semantic tokens only — no raw Tailwind scales.

export function PaymentsListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="bg-muted/50 h-7 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted/30 h-4 w-80 animate-pulse rounded" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="bg-muted/40 h-9 w-40 animate-pulse rounded-md" />
        <div className="bg-muted/40 h-9 w-56 animate-pulse rounded-md" />
      </div>
      <div className="border-border/60 bg-card/40 space-y-2 rounded-xl border p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  );
}
