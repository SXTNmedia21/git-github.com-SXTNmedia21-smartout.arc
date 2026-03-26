"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Activity, ClipboardCheck } from "lucide-react";
import { DashboardContext } from "./DashboardShell";
import { useUnreconciledDays } from "@/app/dashboard/reconciliation/_hooks/useUnreconciledDays";

type StatusSegment = {
  icon: React.ReactNode;
  label: string;
  status: "success" | "warning" | "destructive" | "muted";
  href: string;
};

const statusColors = {
  success: "text-emerald-500",
  warning: "text-orange-500",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
} as const;

const dotColors = {
  success: "bg-emerald-500",
  warning: "bg-orange-500",
  destructive: "bg-destructive",
  muted: "bg-muted-foreground",
} as const;

/**
 * Glanceable status bar for the admin dashboard daily loop.
 * Phase 1: Only the reconciliation segment shows live data.
 * Schedule and operations segments show "no data" until their
 * data sources are wired in Phase 3.
 */
export function DailyStatusBar() {
  const { workspaceData } = useContext(DashboardContext);
  const router = useRouter();
  const workspaceId = workspaceData?.workspace_id;
  const { data: unreconciledDays } = useUnreconciledDays(workspaceId);

  const unreconciledCount = unreconciledDays?.length ?? 0;

  const segments: StatusSegment[] = [
    {
      icon: <Calendar className="h-4 w-4" />,
      label: "Vaktplan i utkast",
      status: "muted",
      href: "/dashboard/schedule",
    },
    {
      icon: <Activity className="h-4 w-4" />,
      label: "Ingen data",
      status: "muted",
      href: "/dashboard/operations",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" />,
      label:
        unreconciledCount > 0
          ? `${unreconciledCount} dag${unreconciledCount > 1 ? "er" : ""} venter`
          : "Avstemt",
      status: unreconciledCount > 0 ? "warning" : "success",
      href: "/dashboard/reconciliation",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 45, damping: 22, mass: 2 }}
      className="border-border/50 bg-card/70 mb-4 flex items-center gap-1 rounded-lg border px-1 py-1.5 backdrop-blur-md"
    >
      {segments.map((seg, i) => (
        <motion.button
          key={seg.href}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            stiffness: 45,
            damping: 22,
            mass: 2,
            delay: i * 0.06,
          }}
          onClick={() => router.push(seg.href)}
          className="hover:bg-accent flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors"
        >
          <span className={statusColors[seg.status]}>{seg.icon}</span>
          <span className={`${statusColors[seg.status]} font-medium`}>{seg.label}</span>
          <span className={`h-2 w-2 rounded-full ${dotColors[seg.status]}`} />
          {i < segments.length - 1 && <span className="bg-border ml-2 h-4 w-px" />}
        </motion.button>
      ))}
    </motion.div>
  );
}
