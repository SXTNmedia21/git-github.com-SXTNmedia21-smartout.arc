import { SkeletonCard, SkeletonHeading, SkeletonLine, SkeletonEntrance } from "@smartout/ui";

/**
 * Loading skeleton for /dashboard/my-cv.
 * The route is a placeholder while MY_CV feature flag is under development —
 * the skeleton reserves space for the future profile hero + content stack.
 * Nordic Split skeleton primitives per ADR-0115.
 */
export default function MyCvLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="flex flex-col gap-6 p-6"
          role="status"
          aria-live="polite"
          aria-label="Laster min profil"
        >
          <SkeletonHeading className="w-40" />
          <SkeletonCard className="min-h-24">
            <div className="flex items-center gap-4">
              <SkeletonLine className="h-14 w-14 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonLine className="w-1/3" />
                <SkeletonLine className="w-1/4" />
              </div>
            </div>
          </SkeletonCard>
          <SkeletonCard className="min-h-48">
            <SkeletonHeading className="mb-4 h-6 w-1/4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonLine key={i} className="w-full" />
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard className="min-h-32" />
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
