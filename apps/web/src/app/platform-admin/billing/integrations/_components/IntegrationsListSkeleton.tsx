// Nordic Split skeleton for the integrations list. Used as the Suspense
// fallback for page.tsx while the Server Component resolves. Semantic
// tokens only (bg-muted/bg-card/border-border) — no raw Tailwind colors.

export function IntegrationsListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="bg-muted/50 h-7 w-48 animate-pulse rounded-lg" />
          <div className="bg-muted/30 h-4 w-80 animate-pulse rounded" />
        </div>
        <div className="bg-muted/40 h-10 w-40 animate-pulse rounded-md" />
      </div>
      <div className="border-border/60 bg-card/40 space-y-2 rounded-xl border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-md" />
        ))}
      </div>
    </div>
  );
}
