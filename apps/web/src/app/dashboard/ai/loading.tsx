export default function AILoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-32 animate-pulse rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
        <div className="bg-muted h-48 animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-lg" />
    </div>
  );
}
