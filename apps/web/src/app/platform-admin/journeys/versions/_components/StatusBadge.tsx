// ============================================
// StatusBadge.tsx — journey_version_status badge (ADR-0172, ADR-0177)
//
// Single source of status presentation for the authoring surface.
// Uses Nordic Split tokens only — zero hardcoded colors. Emphasis comes
// from contrasting token intensities, not bespoke hues.
// ============================================

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type JourneyVersionStatus } from "../_lib/version-status";

/**
 * Status-badge variant table. Every entry picks from the design-token set
 * (bg-muted, bg-primary, bg-secondary, text-foreground, text-muted-foreground
 * etc.) — not from raw zinc/gray/hex. ADR-0177 requires tokens-only.
 *
 * `variant` uses shadcn/ui Badge variants; `className` layers token classes
 * to differentiate states without leaving the palette.
 */
const STATUS_VARIANT: Record<
  JourneyVersionStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className: string }
> = {
  draft: {
    variant: "outline",
    className: "border-border text-muted-foreground",
  },
  ready_test: {
    variant: "secondary",
    className: "bg-muted text-foreground",
  },
  testing: {
    variant: "secondary",
    className: "bg-secondary text-secondary-foreground",
  },
  ready_publish: {
    variant: "default",
    className: "bg-primary text-primary-foreground",
  },
  published: {
    variant: "default",
    className: "bg-primary text-primary-foreground",
  },
  archived: {
    variant: "outline",
    className: "border-border text-muted-foreground opacity-60",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: JourneyVersionStatus;
  className?: string;
}) {
  const cfg = STATUS_VARIANT[status];
  return (
    <Badge variant={cfg.variant} className={cn("font-medium", cfg.className, className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
