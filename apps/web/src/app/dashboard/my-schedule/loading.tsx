export default function MyScheduleLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-40 animate-pulse rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-muted h-20 flex-1 animate-pulse rounded-lg" />
        ))}
      </div>
      <div className="bg-muted h-48 animate-pulse rounded-lg" />
    </div>
  );
}
