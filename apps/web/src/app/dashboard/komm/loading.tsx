export default function ChannelsLoading() {
  return (
    <div className="flex h-full animate-pulse gap-0">
      <div className="bg-muted/30 w-80 border-r p-4">
        <div className="bg-muted mb-4 h-8 w-full rounded" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="bg-muted h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-3/4 rounded" />
                <div className="bg-muted h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col">
        <div className="bg-muted/30 h-14 border-b" />
        <div className="flex-1" />
        <div className="bg-muted/30 h-16 border-t" />
      </div>
    </div>
  );
}
