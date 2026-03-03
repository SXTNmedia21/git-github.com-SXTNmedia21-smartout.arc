export default function GovernanceLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
      <div className="flex gap-2">
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-10 w-24 animate-pulse rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-16 animate-pulse rounded-lg" />
        <div className="bg-muted h-16 animate-pulse rounded-lg" />
        <div className="bg-muted h-16 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
