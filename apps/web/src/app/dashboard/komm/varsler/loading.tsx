/**
 * Loading skeleton for /dashboard/komm/varsler.
 * Mirrors the layout of VarslerClient: header + filter pills + notification rows.
 */
export default function VarslerLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-8 w-20 animate-pulse rounded-full" />
        ))}
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
          <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
