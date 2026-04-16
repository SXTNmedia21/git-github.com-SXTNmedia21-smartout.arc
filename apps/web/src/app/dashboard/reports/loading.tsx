import { SkeletonHeading, SkeletonCard, SkeletonLine, SkeletonChart } from "@smartout/ui";

export default function ReportsLoading() {
  return (
    <div
      className="flex flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-label="Laster rapporter"
    >
      <SkeletonHeading className="h-9 w-40" />

      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonHeading key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SkeletonCard className="min-h-28">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonHeading className="mt-2 h-7 w-1/2" />
        </SkeletonCard>
        <SkeletonCard className="min-h-28">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonHeading className="mt-2 h-7 w-1/2" />
        </SkeletonCard>
        <SkeletonCard className="min-h-28">
          <SkeletonLine className="h-3 w-1/3" />
          <SkeletonHeading className="mt-2 h-7 w-1/2" />
        </SkeletonCard>
      </div>

      <SkeletonChart className="min-h-64" />
    </div>
  );
}
