import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: string;
  size?: "sm" | "default";
};

const statusColorMap: Record<string, string> = {
  // Green
  active: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  signed: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  published: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  // Blue
  trial: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  draft: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  pending: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  // Orange
  past_due: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  expiring: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  // Red
  cancelled: "bg-red-500/15 text-red-500 border-red-500/20",
  expired: "bg-red-500/15 text-red-500 border-red-500/20",
  failed: "bg-red-500/15 text-red-500 border-red-500/20",
  // Zinc/neutral
  paused: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  archived: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  inactive: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const defaultColor = "bg-secondary text-secondary-foreground border-transparent";

export function StatusBadge({ status, size = "default" }: StatusBadgeProps) {
  const normalized = status.toLowerCase().replace(/[\s-]/g, "_");
  const colorClass = statusColorMap[normalized] ?? defaultColor;

  return (
    <Badge variant="outline" className={cn(colorClass, size === "sm" && "px-1.5 py-0 text-[10px]")}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
