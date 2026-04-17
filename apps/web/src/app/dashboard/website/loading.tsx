import { SkeletonCard, SkeletonHeading } from "@smartout/ui";

export default function WebsiteLoading() {
  return (
    <div
      className="z-10 flex-1 overflow-y-auto px-4 pt-8 pb-20 md:px-10"
      role="status"
      aria-live="polite"
      aria-label="Laster nettside"
    >
      <SkeletonHeading className="mb-6 h-8 w-48" />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="min-h-[96px]" />
        ))}
      </div>

      <SkeletonCard className="min-h-64" />
    </div>
  );
}
