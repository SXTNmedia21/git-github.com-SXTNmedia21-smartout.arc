"use client";

// TaskSwiperCard — individual action card shown inside the TaskSwiper stack.
// Supports drag-to-dismiss, severity strip, inline primary/secondary actions,
// and accessible fallback buttons when the user prefers reduced motion.

import { useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSeverityToneStyles } from "../cockpit/severity-styles";

export type TaskCardType =
  | "shift_gap"
  | "deviation"
  | "overdue_task"
  | "late_arrival"
  | "pending_approval"
  | "upcoming_task";

export type TaskCardSeverity = "critical" | "warning" | "info";

export type TaskSwiperCardProps = {
  id: string;
  type: TaskCardType;
  title: string;
  subtitle: string;
  severity: TaskCardSeverity;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  onDismiss: () => void;
  /** Accessible navigation when prefers-reduced-motion is active */
  onPrev?: () => void;
  onNext?: () => void;
  reducedMotion?: boolean;
};

// Severity strip color mapping — left-edge 4px color indicator
const SEVERITY_STRIP_COLOR: Record<TaskCardSeverity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
};

// Severity icon mapping — icon appears alongside the title
const SEVERITY_ICON: Record<TaskCardSeverity, LucideIcon> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  info: Info,
};

// Drag dismissal threshold as fraction of card width
const DISMISS_THRESHOLD = 0.5;

// Interactive spring for snap-back animation
const SNAP_BACK_SPRING = {
  type: "spring" as const,
  stiffness: 100,
  damping: 16,
};

// Exit animation — 250ms minimum per design spec
const EXIT_TRANSITION = { duration: 0.25 };

export function TaskSwiperCard({
  id,
  type,
  title,
  subtitle,
  severity,
  primaryAction,
  secondaryAction,
  onDismiss,
  onPrev,
  onNext,
  reducedMotion = false,
}: TaskSwiperCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-300, 0, 300], [0, 1, 0]);

  const SeverityIcon = SEVERITY_ICON[severity];
  const stripColor = SEVERITY_STRIP_COLOR[severity];
  const toneStyles = getSeverityToneStyles(severity);
  const shouldPulse = severity === "critical";

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const cardWidth = cardRef.current?.offsetWidth ?? 300;
      if (Math.abs(info.offset.x) > cardWidth * DISMISS_THRESHOLD) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  // Type badge label — uses the card type as a short pill
  const typeBadgeLabel = type.replace(/_/g, " ");

  return (
    <motion.div
      ref={cardRef}
      data-card-id={id}
      layout
      style={reducedMotion ? undefined : { x, opacity }}
      drag={reducedMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={reducedMotion ? undefined : handleDragEnd}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { x: 300, opacity: 0, transition: EXIT_TRANSITION }
      }
      transition={reducedMotion ? { duration: 0.2 } : { ...SNAP_BACK_SPRING, opacity: { duration: 0.5 } }}
      className={`bg-card border-border relative flex min-h-[10rem] max-h-[14rem] overflow-hidden rounded-2xl border ${
        shouldPulse ? "animate-glow-pulse" : ""
      }`}
    >
      {/* Left severity strip — 4px wide color indicator */}
      <div className={`w-1 shrink-0 rounded-l-2xl ${stripColor}`} />

      <div className="flex flex-1 flex-col justify-between p-4">
        {/* Top row: type badge + relative timestamp placeholder */}
        <div className="flex items-start justify-between">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${toneStyles.badge}`}
          >
            {typeBadgeLabel}
          </span>
        </div>

        {/* Center: severity icon + title + subtitle */}
        <div className="my-2 flex-1">
          <div className="flex items-center gap-1.5">
            <SeverityIcon className={`h-3.5 w-3.5 shrink-0 ${toneStyles.icon}`} />
            <span className="text-foreground text-sm font-semibold leading-tight">
              {title}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed line-clamp-2">
            {subtitle}
          </p>
        </div>

        {/* Bottom: action buttons + reduced-motion navigation */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={primaryAction.onClick}
            className="bg-[var(--color-brand-orange)] hover:bg-[var(--color-brand-orange)]/90 rounded-lg px-4 py-2 text-xs font-medium text-white"
          >
            {primaryAction.label}
          </Button>

          {secondaryAction && (
            <Button
              variant="ghost"
              size="sm"
              onClick={secondaryAction.onClick}
              className="text-xs"
            >
              {secondaryAction.label}
            </Button>
          )}

          {/* Spacer pushes nav buttons right */}
          <div className="flex-1" />

          {/* Reduced-motion fallback: show prev/next arrows instead of drag */}
          {reducedMotion && (
            <div className="flex items-center gap-1">
              {onPrev && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPrev}
                  className="h-7 w-7"
                  aria-label="Previous card"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {onNext && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onNext}
                  className="h-7 w-7"
                  aria-label="Next card"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
