export default function SeasonLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-36 animate-pulse rounded-lg" />
      <div className="flex gap-2">
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
