import { SkeletonCard, SkeletonHeading } from "@smartout/ui";

export default function CloseLoading() {
  return (
    <div
      className="flex flex-col gap-6 p-6"
      role="status"
      aria-live="polite"
      aria-label="Laster dagsoppgjør"
    >
      <SkeletonHeading className="h-8 w-40" />
      <SkeletonCard className="min-h-32" />
      <SkeletonCard className="min-h-48" />
    </div>
  );
}
