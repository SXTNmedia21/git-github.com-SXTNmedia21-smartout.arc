export default function UsersLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="bg-muted/50 h-8 w-32 animate-pulse rounded-lg" />
        <div className="bg-muted/30 mt-1 h-4 w-64 animate-pulse rounded" />
      </div>
      <div className="space-y-2">
        <div className="bg-muted/30 h-9 w-72 animate-pulse rounded-lg" />
        <div className="border-border/50 rounded-md border">
          <div className="bg-muted/30 h-10 animate-pulse rounded-t-md" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="border-border/20 bg-muted/10 h-12 animate-pulse border-t" />
          ))}
        </div>
      </div>
    </div>
  );
}
