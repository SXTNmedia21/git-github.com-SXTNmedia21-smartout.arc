import {
  SkeletonCard,
  SkeletonHeading,
  SkeletonLine,
  SkeletonTableRow,
  SkeletonEntrance,
} from "@smartout/ui";

export default function InvoiceDetailLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div className="space-y-6" role="status" aria-live="polite" aria-label="Laster faktura">
          <header className="space-y-2">
            <SkeletonHeading className="h-9 w-64" />
            <SkeletonLine className="h-4 w-1/2" />
          </header>

          <SkeletonCard className="min-h-48 p-4">
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-40" />
              <div className="border-border border-b pb-3">
                <div className="flex gap-4">
                  <SkeletonLine className="w-32" />
                  <SkeletonLine className="w-24" />
                  <SkeletonLine className="ml-auto w-20" />
                </div>
              </div>
              <div className="divide-border/40 divide-y">
                {Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonTableRow key={i} className="py-2" />
                ))}
              </div>
            </div>
          </SkeletonCard>

          <SkeletonCard className="p-4">
            <div className="space-y-3">
              <SkeletonLine className="h-5 w-36" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="mt-2 h-10 w-32" />
            </div>
          </SkeletonCard>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
