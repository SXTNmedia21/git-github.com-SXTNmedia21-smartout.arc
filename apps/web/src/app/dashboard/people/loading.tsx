export default function PeopleLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-32 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-28 animate-pulse rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-14 animate-pulse rounded-lg" />
        <div className="bg-muted h-14 animate-pulse rounded-lg" />
        <div className="bg-muted h-14 animate-pulse rounded-lg" />
        <div className="bg-muted h-14 animate-pulse rounded-lg" />
        <div className="bg-muted h-14 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
