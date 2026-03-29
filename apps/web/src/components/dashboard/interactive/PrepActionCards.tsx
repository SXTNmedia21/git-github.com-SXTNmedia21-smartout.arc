"use client";

// PrepActionCards — scrollable vertical stack of actionable preparatory cards.
// Aggregates staffing gaps, unsigned contracts, and expiring training into
// a prioritised list. InlineTaskCreator is always pinned at the bottom.

import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useStaffingCoverage,
  useActionItems,
  useTrainingReadiness,
  getCurrentWeekStart,
} from "@/app/dashboard/_hooks";
import { InlineTaskCreator } from "./InlineTaskCreator";

// Ambient spring — Nordic Split spec
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

// Severity types for card sorting and colour coding
type CardSeverity = "critical" | "warning" | "info";

type ActionCard = {
  id: string;
  severity: CardSeverity;
  text: string;
  actionLabel: string;
  onAction: () => void;
};

/** Maps severity to a solid dot CSS class. */
function severityDot(severity: CardSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-destructive";
    case "warning":
      return "bg-amber-500";
    case "info":
      return "bg-primary";
  }
}

/** Maps fill percent to a card severity level for sort ordering. */
function coverageSeverity(fillPercent: number): CardSeverity {
  if (fillPercent < 60) return "critical";
  if (fillPercent < 80) return "warning";
  return "info";
}

/** Sort order value — critical first. */
function severityOrder(s: CardSeverity): number {
  if (s === "critical") return 0;
  if (s === "warning") return 1;
  return 2;
}

/** Short weekday name from ISO date string. */
function dayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("nb-NO", { weekday: "short" });
}

type ActionCardRowProps = {
  card: ActionCard;
  reducedMotion: boolean;
};

/** Single action card row — severity dot + text + ghost action button. */
function ActionCardRow({ card, reducedMotion }: ActionCardRowProps) {
  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: reducedMotion ? { duration: 0 } : AMBIENT_SPRING }}
      exit={
        reducedMotion
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, y: -8, transition: { duration: 0.15 } }
      }
      className="bg-card border-border flex items-center justify-between rounded-xl border p-3"
    >
      {/* Left: severity dot + descriptive text */}
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${severityDot(card.severity)}`}
          aria-hidden="true"
        />
        <span className="text-foreground truncate text-sm">{card.text}</span>
      </div>

      {/* Right: ghost action button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={card.onAction}
        className="text-muted-foreground hover:text-foreground ml-2 shrink-0 text-xs"
      >
        {card.actionLabel}
      </Button>
    </motion.div>
  );
}

type Props = {
  profileId: string;
};

/**
 * PrepActionCards — aggregated card list for preparatory dashboard mode.
 *
 * Why: Before a shift opens, the most useful view is a prioritised action list:
 * what needs staffing, what contracts need signing, what training is expiring.
 * Cards are sorted critical-first so the most urgent items are always at the top.
 */
export function PrepActionCards({ profileId }: Props) {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const prefersReduced = useReducedMotion() ?? false;

  const weekStart = getCurrentWeekStart();
  const coverage = useStaffingCoverage(weekStart);
  const actionItems = useActionItems();
  const trainingReadiness = useTrainingReadiness();

  const cards: ActionCard[] = [];

  // ── 1. Staffing gaps — one card per day with fill < 100% in the next 7 days ──
  if (coverage.data) {
    for (const day of coverage.data) {
      if (day.fillPercent < 100 && day.totalShifts > 0) {
        const gaps = day.totalShifts - day.assignedShifts;
        const sev = coverageSeverity(day.fillPercent);
        cards.push({
          id: `gap-${day.date}`,
          severity: sev,
          text: `${dayName(day.date)} ${day.date} — ${gaps} hull`,
          actionLabel: t("interactive.swiper_shift_gap"),
          onAction: () => router.push("/dashboard/schedule"),
        });
      }
    }
  }

  // ── 2. Unsigned contracts ──
  const pendingContracts = actionItems.data?.pendingContracts ?? 0;
  if (pendingContracts > 0) {
    cards.push({
      id: "contracts",
      severity: "warning",
      text: `${pendingContracts} ${t("interactive.prep_contract_waiting")}`,
      actionLabel: t("interactive.prep_view"),
      onAction: () => router.push("/dashboard/governance"),
    });
  }

  // ── 3. Expiring or overdue training ──
  const expiredTraining = trainingReadiness.data?.expired ?? 0;
  const pendingTraining = trainingReadiness.data?.pending ?? 0;
  const trainingIssues = expiredTraining + pendingTraining;

  if (trainingIssues > 0) {
    // Use the current date as a reference label for "expires"
    const refDate = new Date().toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
    });

    cards.push({
      id: "training",
      severity: expiredTraining > 0 ? "critical" : "warning",
      text: `${trainingIssues} ${t("interactive.prep_training_expires", { date: refDate })}`,
      actionLabel: t("interactive.prep_remind"),
      onAction: () => toast.info(t("interactive.prep_remind")),
    });
  }

  // Sort: critical → warning → info
  cards.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));

  const isLoading = coverage.isLoading || actionItems.isLoading || trainingReadiness.isLoading;
  const isEmpty = cards.length === 0 && !isLoading;

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border-border h-[52px] animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Empty state */}
      {isEmpty && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1, transition: prefersReduced ? { duration: 0 } : AMBIENT_SPRING }}
          className="flex flex-col items-center gap-2 py-6 text-center"
        >
          <CheckCircle className="text-success h-8 w-8" />
          <p className="text-muted-foreground text-sm">{t("interactive.all_clear_prep")}</p>
        </motion.div>
      )}

      {/* Action card list */}
      <AnimatePresence mode="popLayout">
        {cards.map((card) => (
          <ActionCardRow key={card.id} card={card} reducedMotion={prefersReduced} />
        ))}
      </AnimatePresence>

      {/* InlineTaskCreator — always pinned at the bottom of the prep list */}
      <div className="pt-1">
        <InlineTaskCreator mode="preparatory" profileId={profileId} />
      </div>
    </div>
  );
}
