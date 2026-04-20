import { SkeletonCard, SkeletonHeading, SkeletonEntrance } from "@smartout/ui";

export default function AILoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="flex flex-col gap-6 p-6"
          role="status"
          aria-live="polite"
          aria-label="Laster Mr. Botsson"
        >
          <SkeletonHeading className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard className="min-h-40" />
            <SkeletonCard className="min-h-40" />
            <SkeletonCard className="min-h-40" />
          </div>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
