import { SkeletonHeading, SkeletonCard, SkeletonLine, SkeletonTableRow } from "@smartout/ui";

export default function HmsDocumentsLoading() {
  return (
    <div className="space-y-6 p-6" role="status" aria-live="polite" aria-label="Laster dokumenter">
      <SkeletonHeading className="h-9 w-48" />

      <SkeletonCard className="min-h-28">
        <SkeletonLine className="h-3 w-1/3" />
        <SkeletonHeading className="mt-2 h-6 w-1/2" />
      </SkeletonCard>

      <SkeletonCard className="min-h-64">
        <SkeletonHeading className="mb-4 h-5 w-1/4" />
        <div className="space-y-2">
          <SkeletonTableRow />
          <SkeletonTableRow />
          <SkeletonTableRow />
          <SkeletonTableRow />
          <SkeletonTableRow />
        </div>
      </SkeletonCard>
    </div>
  );
}
