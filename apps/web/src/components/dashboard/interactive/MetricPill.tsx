"use client";

// MetricPill — single badge displaying icon + value + label with optional glow
// animation for critical severity. Used by DashboardMetricStrip.

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  getSeverityToneStyles,
  type CockpitSeverityTone,
} from "../cockpit/severity-styles";

type MetricPillProps = {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone: CockpitSeverityTone;
  isLoading?: boolean;
};

// Pulsing glow keyframes — draws attention to non-zero critical metrics
const GLOW_KEYFRAMES = {
  boxShadow: [
    "0 0 0 0 var(--glow-brand, rgba(255,107,53,0))",
    "0 0 10px 3px var(--glow-brand, rgba(255,107,53,0.3))",
    "0 0 0 0 var(--glow-brand, rgba(255,107,53,0))",
  ],
};

export function MetricPill({ icon: Icon, value, label, tone, isLoading }: MetricPillProps) {
  const styles = getSeverityToneStyles(tone);
  const shouldGlow = tone === "critical" && value !== 0 && value !== "0%";

  return (
    <motion.div
      animate={shouldGlow ? GLOW_KEYFRAMES : undefined}
      transition={shouldGlow ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : undefined}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        value === 0 || value === "0%"
          ? "border-border text-muted-foreground"
          : `${styles.badge}`
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="tabular-nums font-semibold">
        {isLoading ? "—" : value}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </motion.div>
  );
}
