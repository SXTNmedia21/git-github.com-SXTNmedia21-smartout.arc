export default function ContractsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-muted/50 h-8 w-36 animate-pulse rounded-lg" />
          <div className="bg-muted/30 mt-1 h-4 w-72 animate-pulse rounded" />
        </div>
        <div className="flex gap-2">
          <div className="bg-muted/30 h-9 w-24 animate-pulse rounded" />
          <div className="bg-muted/30 h-9 w-28 animate-pulse rounded" />
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
