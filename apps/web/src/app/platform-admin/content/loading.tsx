export default function ContentLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted/50 h-8 w-36 animate-pulse rounded-lg" />
        <div className="bg-muted/30 mt-1 h-4 w-52 animate-pulse rounded" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-muted/20 h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}
