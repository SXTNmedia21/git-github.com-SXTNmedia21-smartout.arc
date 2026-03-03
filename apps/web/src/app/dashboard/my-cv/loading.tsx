export default function MyCvLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-32 animate-pulse rounded-lg" />
      <div className="bg-muted h-24 animate-pulse rounded-lg" />
      <div className="bg-muted h-48 animate-pulse rounded-lg" />
      <div className="bg-muted h-32 animate-pulse rounded-lg" />
    </div>
  );
}
