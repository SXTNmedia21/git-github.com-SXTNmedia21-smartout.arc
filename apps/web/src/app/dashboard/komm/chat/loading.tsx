import { SkeletonCard, SkeletonLine, SkeletonAvatar, SkeletonEntrance } from "@smartout/ui";

/**
 * Loading skeleton for /dashboard/komm/chat.
 * Mirrors the two-panel DM geometry in `ChatClient`:
 *   Left (w-72): DM list with avatar + name + last message per row
 *   Right (flex-1): header + message stream + input composer
 * Nordic Split skeleton primitives per ADR-0115.
 */
export default function ChatLoading() {
  return (
    <SkeletonEntrance
      isLoading
      skeleton={
        <div
          className="flex h-full gap-0"
          role="status"
          aria-live="polite"
          aria-label="Laster chat"
        >
          {/* Left: DM list */}
          <div className="border-border/40 bg-muted/30 w-72 border-r p-4">
            <SkeletonLine className="mb-4 h-8 w-full rounded" />
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <SkeletonAvatar />
                  <div className="flex-1 space-y-2">
                    <SkeletonLine className="w-2/3" />
                    <SkeletonLine className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: chat view */}
          <div className="flex flex-1 flex-col">
            <div className="border-border/40 bg-muted/30 h-14 border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <SkeletonAvatar />
                <SkeletonLine className="h-5 w-1/4" />
              </div>
            </div>
            <div className="flex-1 space-y-4 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonCard
                  key={i}
                  className={`min-h-14 max-w-md ${i % 2 === 0 ? "" : "ml-auto"}`}
                >
                  <SkeletonLine className="mb-2 w-1/4" />
                  <SkeletonLine className="w-full" />
                </SkeletonCard>
              ))}
            </div>
            <div className="border-border/40 bg-muted/30 h-16 border-t px-4 py-3">
              <SkeletonLine className="h-8 w-full rounded-full" />
            </div>
          </div>
        </div>
      }
    >
      {null}
    </SkeletonEntrance>
  );
}
