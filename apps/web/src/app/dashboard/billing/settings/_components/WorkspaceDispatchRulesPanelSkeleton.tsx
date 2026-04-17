// Nordic Split skeleton mirroring the two-section workspace panel.
// Semantic tokens only — no raw color scales.

export function WorkspaceDispatchRulesPanelSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="bg-muted/50 h-8 w-48 animate-pulse rounded-lg" />
        <div className="bg-muted/30 h-4 w-80 animate-pulse rounded" />
      </div>
      <section className="bg-muted/40 border-border/60 space-y-3 rounded-xl border p-4">
        <div className="bg-muted/30 h-5 w-40 animate-pulse rounded" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-10 animate-pulse rounded-md" />
        ))}
      </section>
      <section className="bg-card/40 border-border/60 space-y-3 rounded-xl border p-4">
        <div className="bg-muted/30 h-5 w-40 animate-pulse rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-10 animate-pulse rounded-md" />
        ))}
      </section>
    </div>
  );
}
