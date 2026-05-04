export default function GuardianLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted/50 h-8 w-40 animate-pulse rounded-lg" />
        <div className="bg-muted/30 mt-1 h-4 w-56 animate-pulse rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-28 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-14 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
