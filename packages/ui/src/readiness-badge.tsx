import { AlertTriangle, Check, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "./lib/utils";

export type ReadinessState = "ready" | "in_progress" | "blocked";

type StateConfig = {
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
  className: string;
};

const STATE_CONFIG: Record<ReadinessState, StateConfig> = {
  ready: {
    icon: Check,
    label: "Klar",
    ariaLabel: "Status: Klar",
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  in_progress: {
    icon: Clock,
    label: "Pågår",
    ariaLabel: "Status: Pågår",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  blocked: {
    icon: AlertTriangle,
    label: "Blokkert",
    ariaLabel: "Status: Blokkert",
    className: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
};

export type ReadinessBadgeProps = {
  state: ReadinessState;
  className?: string;
};

export function ReadinessBadge({ state, className }: ReadinessBadgeProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <span
      role="status"
      aria-label={config.ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </span>
  );
}
