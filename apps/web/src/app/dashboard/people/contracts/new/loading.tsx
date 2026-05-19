// Streaming skeleton for /dashboard/people/contracts/new — redirect stub, shown for one frame.

export default function NewContractLoading() {
  return (
    <div
      className="flex min-h-[200px] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Omdirigerer"
    >
      <div className="bg-muted h-8 w-48 animate-pulse rounded-lg" />
    </div>
  );
}
