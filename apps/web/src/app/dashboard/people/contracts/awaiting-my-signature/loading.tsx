// Streaming skeleton for /dashboard/people/contracts/awaiting-my-signature — list of pending signing rows.

export default function AwaitingSignatureLoading() {
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-live="polite"
      aria-label="Laster kontrakter til signering"
    >
      {/* Page header */}
      <div className="bg-muted h-7 w-72 animate-pulse rounded-lg" />

      {/* Pending signature card rows */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-muted h-20 w-full animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
