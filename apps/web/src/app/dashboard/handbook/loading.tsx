import { Skeleton, SkeletonHeading, SkeletonLine, SkeletonCard } from "@smartout/ui";

export default function HandbookLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-live="polite" aria-label="Laster handbok">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <SkeletonHeading className="h-9 w-64" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        <SkeletonLine className="h-4 w-80" />
      </div>

      <div className="grid gap-6 md:grid-cols-[256px_1fr]">
        <SkeletonCard className="min-h-96">
          <SkeletonLine className="mb-4 h-4 w-1/2" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonLine key={i} className="h-4" />
            ))}
          </div>
        </SkeletonCard>

        <SkeletonCard className="min-h-96">
          <SkeletonHeading className="mb-4" />
          <div className="space-y-2">
            <SkeletonLine />
            <SkeletonLine className="w-11/12" />
            <SkeletonLine className="w-3/4" />
            <div className="h-4" />
            <SkeletonLine />
            <SkeletonLine className="w-5/6" />
            <SkeletonLine className="w-2/3" />
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}
