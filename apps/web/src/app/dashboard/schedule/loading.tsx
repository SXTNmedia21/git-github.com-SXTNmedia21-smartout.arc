export default function ScheduleLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-36 animate-pulse rounded-lg" />
        <div className="flex gap-2">
          <div className="bg-muted h-10 w-10 animate-pulse rounded-lg" />
          <div className="bg-muted h-10 w-10 animate-pulse rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-muted h-24 flex-1 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-lg" />
    </div>
  );
}
