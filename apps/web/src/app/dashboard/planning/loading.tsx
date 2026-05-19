import { SkeletonHeading, SkeletonCard, SkeletonLine } from "@smartout/ui";

export default function PlanningLoading() {
  return (
    <div
      className="flex flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-label="Laster planlegging"
    >
      <SkeletonHeading className="h-9 w-40" />

      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonHeading key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>

      <SkeletonCard className="min-h-96">
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonHeading className="mt-2 h-7 w-1/2" />
      </SkeletonCard>
    </div>
  );
}
