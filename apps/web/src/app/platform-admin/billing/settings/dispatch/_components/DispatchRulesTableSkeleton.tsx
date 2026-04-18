// Nordic Split skeleton for the dispatch rules settings table. Used as
// the Suspense fallback for page.tsx. Semantic tokens only — no raw
// Tailwind colour scales (zinc/gray/slate are out per Nordic Split).

export function DispatchRulesTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="bg-muted/50 h-7 w-64 animate-pulse rounded-lg" />
          <div className="bg-muted/30 h-4 w-96 animate-pulse rounded" />
        </div>
        <div className="bg-muted/40 h-10 w-40 animate-pulse rounded-md" />
      </div>
      <div className="bg-card/40 border-border/60 space-y-3 rounded-xl border p-4">
        <div className="bg-muted/30 h-5 w-48 animate-pulse rounded" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-11 animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  );
}
