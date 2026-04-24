import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ServiceTag } from "./service-registry";
import { TAG_LABELS } from "./service-registry";

const TAG_COLORS: Record<ServiceTag, string> = {
  supabase: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20",
  ai: "bg-violet-500/15 text-violet-500 border-violet-500/20",
  billing: "bg-blue-500/15 text-blue-500 border-blue-500/20",
  notifications: "bg-amber-500/15 text-amber-500 border-amber-500/20",
  contracts: "bg-cyan-500/15 text-cyan-500 border-cyan-500/20",
  monitoring: "bg-orange-500/15 text-orange-500 border-orange-500/20",
  infra: "bg-muted text-muted-foreground border-border",
};

type TagBadgeProps = {
  tag: ServiceTag;
  className?: string;
};

export function TagBadge({ tag, className }: TagBadgeProps) {
  return (
    <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", TAG_COLORS[tag], className)}>
      {TAG_LABELS[tag]}
    </Badge>
  );
}
