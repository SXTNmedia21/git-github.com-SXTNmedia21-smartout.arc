export default function MyTrainingLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-40 animate-pulse rounded-lg" />
      <div className="bg-muted h-4 w-full animate-pulse rounded-full" />
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-20 animate-pulse rounded-lg" />
        <div className="bg-muted h-20 animate-pulse rounded-lg" />
        <div className="bg-muted h-20 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
