export default function ChatLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-muted h-8 w-36 animate-pulse rounded-lg" />
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-12 w-3/4 animate-pulse rounded-lg" />
        <div className="bg-muted h-12 w-1/2 animate-pulse self-end rounded-lg" />
        <div className="bg-muted h-12 w-2/3 animate-pulse rounded-lg" />
      </div>
      <div className="bg-muted h-12 animate-pulse rounded-lg" />
    </div>
  );
}
