export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-32 animate-pulse rounded-lg" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-muted h-28 animate-pulse rounded-lg" />
        <div className="bg-muted h-28 animate-pulse rounded-lg" />
        <div className="bg-muted h-28 animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-lg" />
    </div>
  );
}
