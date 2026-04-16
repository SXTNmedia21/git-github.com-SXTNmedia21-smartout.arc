import { Skeleton, SkeletonLine, SkeletonHeading } from "@smartout/ui";

/**
 * EditorSkeleton — shared placeholder for TipTap-based editors loaded via
 * `next/dynamic`. Mimics the fundamental editor shape (toolbar + content
 * area) so the swap from skeleton → real editor is visually seamless.
 *
 * Used in:
 * - contract-send-drawer (preview editor)
 * - document-mode-shell (canvas)
 * - platform-admin/contracts/templates (template editor)
 * - platform-admin/communications/compose (rich email)
 */
export function EditorSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="border-border/40 mb-3 flex items-center gap-2 rounded-lg border p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-7 rounded" />
        ))}
        <Skeleton className="ml-auto h-7 w-24 rounded" />
      </div>
      <div className="border-border/40 space-y-3 rounded-lg border p-6">
        <SkeletonHeading />
        <SkeletonLine />
        <SkeletonLine className="w-11/12" />
        <SkeletonLine className="w-4/5" />
        <SkeletonLine className="w-3/5" />
        <div className="h-4" />
        <SkeletonLine />
        <SkeletonLine className="w-10/12" />
        <SkeletonLine className="w-2/3" />
      </div>
    </div>
  );
}
