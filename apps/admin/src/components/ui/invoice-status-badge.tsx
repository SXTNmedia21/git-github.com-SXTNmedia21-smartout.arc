// invoice-status-badge.tsx — 7-state pill for the billing/orders UI.
//
// Local copy for apps/admin — apps/admin intentionally excludes @smartout/ui
// (web-only AI/dashboard deps). Source of truth for this component lives in
// packages/ui/src/components/invoice-status-badge.tsx. Keep in sync if the
// DB enum changes.
//
// Nordic Split: uses CSS variable tokens (bg-success, bg-warning, etc.) —
// never hardcoded OKLCH/zinc/slate values.

import { AlertTriangle, Ban, CheckCircle2, FileText, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "sent"
  | "paid"
  | "overdue"
  | "void"
  | "uncollectible";

type Props = {
  status: InvoiceStatus;
  size?: "sm" | "md";
  withIcon?: boolean;
  className?: string;
};

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string;
    bg: string;
    fg: string;
    Icon: typeof FileText;
  }
> = {
  draft: { label: "Utkast", bg: "bg-muted", fg: "text-muted-foreground", Icon: FileText },
  issued: { label: "Utstedt", bg: "bg-info/15", fg: "text-info-foreground", Icon: Send },
  sent: { label: "Sendt", bg: "bg-info/25", fg: "text-info-foreground", Icon: Send },
  paid: {
    label: "Mottatt og betalt",
    bg: "bg-success/20",
    fg: "text-success-foreground",
    Icon: CheckCircle2,
  },
  overdue: {
    label: "Forfalt",
    bg: "bg-warning/25",
    fg: "text-warning-foreground",
    Icon: AlertTriangle,
  },
  void: {
    label: "Annullert",
    bg: "bg-muted line-through",
    fg: "text-muted-foreground",
    Icon: Ban,
  },
  uncollectible: {
    label: "Avskrevet",
    bg: "bg-destructive/15",
    fg: "text-destructive-foreground",
    Icon: XCircle,
  },
};

export function InvoiceStatusBadge({ status, size = "md", withIcon = true, className }: Props) {
  const cfg = STATUS_CONFIG[status];
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5 gap-1" : "text-sm px-2.5 py-1 gap-1.5";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        cfg.bg,
        cfg.fg,
        sizeClasses,
        className,
      )}
    >
      {withIcon ? (
        <cfg.Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      ) : null}
      <span>{cfg.label}</span>
    </span>
  );
}
