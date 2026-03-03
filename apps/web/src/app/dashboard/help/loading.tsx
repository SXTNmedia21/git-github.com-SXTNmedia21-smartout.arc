export default function HelpLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-28 animate-pulse rounded-lg" />
      <div className="bg-muted h-32 animate-pulse rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
        <div className="bg-muted h-32 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
