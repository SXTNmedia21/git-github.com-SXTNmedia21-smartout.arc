import { cn } from "../lib/utils";

/**
 * Skeleton — loading placeholder for Nordic Split surfaces.
 *
 * Warm `bg-muted` base + fractal noise overlay + warm gradient sweep. Replaces
 * the cold grey `animate-pulse` shadcn pattern on any surface that renders
 * behind the Nordic Split ambience (orbs, noise, glass panels).
 *
 * Use for any `loading.tsx` file and for skeleton states inside dynamically
 * imported components (TipTap editors, charts) where the swap-in moment is
 * visible to the user.
 *
 * For route skeletons with content-specific geometry, compose with the
 * helper variants (SkeletonLine, SkeletonHeading, SkeletonCard, SkeletonAvatar,
 * SkeletonBadge, SkeletonTableRow, SkeletonChart).
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "bg-muted border-border/40 relative overflow-hidden rounded-md border",
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="bg-noise pointer-events-none absolute inset-0 opacity-[0.025] mix-blend-overlay dark:opacity-[0.04]"
      />
      <div
        aria-hidden
        className="animate-nordic-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-[oklch(0.98_0.02_55_/_0.7)] to-transparent dark:via-[oklch(0.28_0.02_55_/_0.5)]"
      />
    </div>
  );
}

/** Horizontal text-line placeholder. Default h-4. */
export function SkeletonLine({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-4 w-full", className)} {...props} />;
}

/**
 * Larger placeholder for h1/h2 in first streamed chunk.
 * Reserves the same metrics as the real heading so Instrument Serif
 * doesn't double-swap as later chunks arrive.
 */
export function SkeletonHeading({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-8 w-3/5 rounded-lg", className)} {...props} />;
}

/** Card-shaped placeholder matching card radius + pad. Compose children for multi-line mocks. */
export function SkeletonCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton
      className={cn("border-border/40 relative min-h-24 rounded-xl border p-4", className)}
      {...props}
    >
      {children}
    </Skeleton>
  );
}

/** Round avatar placeholder. Default h-10 w-10. */
export function SkeletonAvatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-10 w-10 rounded-full", className)} {...props} />;
}

/** Status-pill / badge placeholder. Default h-5 w-16 pill. */
export function SkeletonBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} {...props} />;
}

/**
 * Table-row placeholder — horizontal flex of varying-width lines.
 * Matches dashboard table rhythm (people, contracts, settings tables).
 */
export function SkeletonTableRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-4 py-3", className)} aria-hidden {...props}>
      <SkeletonAvatar className="h-8 w-8" />
      <SkeletonLine className="w-1/4" />
      <SkeletonLine className="w-1/3" />
      <SkeletonLine className="w-1/6" />
      <SkeletonBadge className="ml-auto" />
    </div>
  );
}

/**
 * Chart placeholder — reserves vertical space for Recharts while lazy
 * chunks resolve. Prevents layout shift on /dashboard/reports + /dashboard/cost.
 */
export function SkeletonChart({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <SkeletonCard className={cn("min-h-48", className)} {...props}>
      <SkeletonHeading className="mb-4 h-6 w-2/5" />
      <div className="flex h-32 items-end gap-2">
        <SkeletonLine className="h-1/3 w-8" />
        <SkeletonLine className="h-2/3 w-8" />
        <SkeletonLine className="h-1/2 w-8" />
        <SkeletonLine className="h-3/4 w-8" />
        <SkeletonLine className="h-2/5 w-8" />
        <SkeletonLine className="h-5/6 w-8" />
      </div>
    </SkeletonCard>
  );
}
