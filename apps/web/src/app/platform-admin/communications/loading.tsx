export default function CommunicationsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 animate-pulse rounded-lg bg-zinc-800/50" />
        <div className="mt-1 h-4 w-72 animate-pulse rounded bg-zinc-800/30" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-800/20" />
        ))}
      </div>
    </div>
  );
}
