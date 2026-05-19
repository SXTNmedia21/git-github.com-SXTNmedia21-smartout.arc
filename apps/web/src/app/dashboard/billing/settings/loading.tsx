import { SkeletonCard, SkeletonHeading, SkeletonLine, SkeletonEntrance } from "@smartout/ui";

export default function BillingSettingsLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="space-y-6"
          role="status"
          aria-live="polite"
          aria-label="Laster faktureringsinnstillinger"
        >
          <header className="space-y-2">
            <SkeletonHeading className="h-9 w-56" />
            <SkeletonLine className="h-4 w-2/3" />
          </header>

          <SkeletonCard className="p-4">
            <div className="space-y-4">
              <SkeletonLine className="h-5 w-48" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-5/6" />
              <SkeletonLine className="h-4 w-3/4" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="p-4">
            <div className="space-y-4">
              <SkeletonLine className="h-5 w-40" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-4/5" />
              <SkeletonLine className="h-4 w-2/3" />
            </div>
          </SkeletonCard>

          <SkeletonCard className="p-4">
            <div className="space-y-4">
              <SkeletonLine className="h-5 w-44" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-1/2" />
            </div>
          </SkeletonCard>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
