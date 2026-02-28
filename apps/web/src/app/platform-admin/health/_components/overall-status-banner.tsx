"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type OverallStatusBannerProps = {
  status: "operational" | "degraded" | "down";
};

const config = {
  operational: {
    label: "All Systems Operational",
    icon: CheckCircle2,
    bg: "bg-emerald-500/10 border-emerald-500/20",
    text: "text-emerald-500",
  },
  degraded: {
    label: "Degraded Performance",
    icon: AlertTriangle,
    bg: "bg-orange-500/10 border-orange-500/20",
    text: "text-orange-500",
  },
  down: {
    label: "Service Outage Detected",
    icon: XCircle,
    bg: "bg-red-500/10 border-red-500/20",
    text: "text-red-500",
  },
} as const;

export function OverallStatusBanner({ status }: OverallStatusBannerProps) {
  const c = config[status];
  const Icon = c.icon;

  return (
    <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3", c.bg)}>
      <Icon className={cn("h-5 w-5", c.text)} />
      <span className={cn("text-sm font-medium", c.text)}>{c.label}</span>
    </div>
  );
}
