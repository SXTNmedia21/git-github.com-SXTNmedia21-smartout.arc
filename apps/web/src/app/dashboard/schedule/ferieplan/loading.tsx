/**
 * Ferieplan tab loading skeleton.
 * Shown by Next.js Suspense while server component fetches vacation absences.
 */
export default function FerieplanLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Laster ferieplan…">
      <div className="bg-muted h-8 w-48 animate-pulse rounded-md" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-muted h-16 w-full animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
