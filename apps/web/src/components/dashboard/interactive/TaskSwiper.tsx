"use client";

// TaskSwiper — swipeable card stack showing one action card at a time.
// Aggregates pending items from multiple data sources, sorts by severity,
// and provides inline actions (assign, approve, dismiss) with keyboard nav.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import { useCockpitFirstScreen } from "@/app/dashboard/_hooks/use-cockpit-first-screen";
import { useAssignTask } from "@/app/dashboard/_hooks/use-assign-task";
import { usePendingApprovals } from "@/app/dashboard/_hooks/use-pending-approvals";
import { useEntityDrawerOptional } from "@/components/dashboard/entity-drawer/EntityDrawerContext";
import { AssignPopover } from "./AssignPopover";
import { TaskSwiperCard, type TaskCardSeverity, type TaskCardType } from "./TaskSwiperCard";

type SwiperCard = {
  id: string;
  type: TaskCardType;
  title: string;
  subtitle: string;
  severity: TaskCardSeverity;
  entityType?: string;
  entityId?: string;
  occurredAt: string;
};

const SEVERITY_WEIGHT: Record<TaskCardSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * Detects the user's prefers-reduced-motion media query.
 * Falls back to false (full animation) on SSR.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function TaskSwiper() {
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const drawerCtx = useEntityDrawerOptional();
  const reducedMotion = usePrefersReducedMotion();

  const model = useCockpitFirstScreen({
    feedLimit: 24,
    feedFilters: { category: "all", timeRange: "today" },
  });
  const { data: pendingApprovals } = usePendingApprovals();
  const assignTask = useAssignTask();

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Track which card has its assign popover open
  const [assigningCardId, setAssigningCardId] = useState<string | null>(null);

  // Aggregate all cards from data sources into a unified sorted list
  const allCards = useMemo<SwiperCard[]>(() => {
    const cards: SwiperCard[] = [];

    // Staffing queue → shift_gap cards
    for (const risk of model.staffingQueue) {
      cards.push({
        id: risk.id,
        type: "shift_gap",
        title: t("interactive.card_shift_gap_title"),
        subtitle: t("interactive.card_shift_gap_subtitle", {
          count: risk.uncoveredShifts,
        }),
        severity: risk.severity as TaskCardSeverity,
        occurredAt: risk.occurredAt,
      });
    }

    // Operational queue → deviation / overdue_task / upcoming_task cards
    for (const risk of model.operationalQueue) {
      if (risk.blockingDeviations > 0) {
        cards.push({
          id: risk.id,
          type: "deviation",
          title: t("interactive.card_deviation_title"),
          subtitle: t("interactive.card_deviation_subtitle", {
            count: risk.blockingDeviations,
          }),
          severity: risk.severity as TaskCardSeverity,
          entityType: "department_session",
          entityId: risk.id,
          occurredAt: risk.occurredAt,
        });
      }
      if (risk.overdueTasks > 0) {
        cards.push({
          id: `${risk.id}-overdue`,
          type: "overdue_task",
          title: t("interactive.card_overdue_title"),
          subtitle: t("interactive.card_overdue_subtitle", {
            count: risk.overdueTasks,
          }),
          severity: "critical",
          occurredAt: risk.occurredAt,
        });
      }
      if (risk.upcomingTasks > 0) {
        cards.push({
          id: `${risk.id}-upcoming`,
          type: "upcoming_task",
          title: t("interactive.card_upcoming_title"),
          subtitle: t("interactive.card_upcoming_subtitle", {
            count: risk.upcomingTasks,
          }),
          severity: "info",
          occurredAt: risk.occurredAt,
        });
      }
    }

    // Late arrivals from on-duty entries
    for (const entry of model.onDutyEntries) {
      if (entry.status === "late") {
        cards.push({
          id: `late-${entry.shiftId}`,
          type: "late_arrival",
          title: t("interactive.card_late_title"),
          subtitle: t("interactive.card_late_subtitle", {
            name: entry.employeeName,
            minutes: entry.minutesLate ?? 0,
          }),
          severity: "critical",
          entityType: "shift",
          entityId: entry.shiftId,
          occurredAt: new Date().toISOString(),
        });
      }
    }

    // Pending approvals
    for (const approval of pendingApprovals ?? []) {
      cards.push({
        id: `approval-${approval.session_id}`,
        type: "pending_approval",
        title: t("interactive.card_approval_title"),
        subtitle: t("interactive.card_approval_subtitle", {
          department: approval.department_name,
          date: approval.session_date,
        }),
        severity: "warning",
        entityType: "department_session",
        entityId: approval.session_id,
        occurredAt: approval.session_date,
      });
    }

    // Sort: severity desc → timestamp asc
    cards.sort((a, b) => {
      const severityDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    });

    return cards;
  }, [model.staffingQueue, model.operationalQueue, model.onDutyEntries, pendingApprovals, t]);

  // Filter out dismissed cards
  const visibleCards = useMemo(
    () => allCards.filter((card) => !dismissed.has(card.id)),
    [allCards, dismissed],
  );

  // Clamp index when cards are dismissed
  const safeIndex = Math.min(currentIndex, Math.max(0, visibleCards.length - 1));

  const currentCard = visibleCards[safeIndex] ?? null;

  // Navigation
  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, visibleCards.length - 1));
  }, [visibleCards.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleDismiss = useCallback(
    (cardId: string) => {
      setDismissed((prev) => new Set(prev).add(cardId));
      // If we dismissed the last card, step back
      if (safeIndex >= visibleCards.length - 1) {
        setCurrentIndex((i) => Math.max(i - 1, 0));
      }
    },
    [safeIndex, visibleCards.length],
  );

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Enter" && currentCard) {
        // Trigger primary action — handled inline per card type
      } else if (e.key === "Backspace" && currentCard) {
        handleDismiss(currentCard.id);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, currentCard, handleDismiss]);

  // Build primary action handler per card type
  const buildPrimaryAction = useCallback(
    (card: SwiperCard) => {
      switch (card.type) {
        case "shift_gap":
          return {
            label: t("interactive.action_find_substitute"),
            onClick: () => router.push("/dashboard/schedule"),
          };
        case "deviation":
          // Opens AssignPopover — handled by setting assigningCardId
          return {
            label: t("interactive.action_assign"),
            onClick: () => setAssigningCardId(card.id),
          };
        case "overdue_task":
          return {
            label: t("interactive.action_complete"),
            onClick: () => {
              toast.success(t("interactive.toast_task_completed"));
              handleDismiss(card.id);
            },
          };
        case "late_arrival":
          return {
            label: t("interactive.action_send_reminder"),
            onClick: () => {
              toast.info(t("interactive.toast_reminder_sent"));
            },
          };
        case "pending_approval":
          return {
            label: t("interactive.action_approve"),
            onClick: () => {
              toast.success(t("interactive.toast_approved"));
              handleDismiss(card.id);
            },
          };
        case "upcoming_task":
          return {
            label: t("interactive.action_view"),
            onClick: () => {
              if (card.entityType && card.entityId && drawerCtx) {
                drawerCtx.openDrawer(card.entityType as "department_session", card.entityId);
              }
            },
          };
        default:
          return { label: t("interactive.action_view"), onClick: () => {} };
      }
    },
    [t, router, handleDismiss, drawerCtx],
  );

  // Build secondary action — either "Se detaljer" (open drawer) or "Avvis" (dismiss)
  const buildSecondaryAction = useCallback(
    (card: SwiperCard) => {
      if (card.entityType && card.entityId && drawerCtx) {
        return {
          label: t("interactive.action_details"),
          onClick: () =>
            drawerCtx.openDrawer(card.entityType as "department_session", card.entityId!),
        };
      }
      return {
        label: t("interactive.action_dismiss"),
        onClick: () => handleDismiss(card.id),
      };
    },
    [t, drawerCtx, handleDismiss],
  );

  // Loading state — skeleton card
  if (model.isLoading) {
    return (
      <div className="bg-card border-border flex max-h-[14rem] min-h-[10rem] animate-pulse items-center justify-center rounded-2xl border">
        <div className="bg-muted h-4 w-32 rounded" />
      </div>
    );
  }

  // Empty state — all clear
  if (visibleCards.length === 0) {
    return (
      <div className="bg-success/5 border-success/20 flex max-h-[14rem] min-h-[10rem] flex-col items-center justify-center gap-2 rounded-2xl border">
        <CheckCircle className="text-success h-8 w-8" />
        <span className="text-muted-foreground text-sm">{t("interactive.swiper_empty")}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {currentCard && (
          <div key={currentCard.id}>
            {/* Wrap in AssignPopover when this card is being assigned */}
            {assigningCardId === currentCard.id && currentCard.type === "deviation" ? (
              <AssignPopover
                trigger={
                  <div>
                    <TaskSwiperCard
                      id={currentCard.id}
                      type={currentCard.type}
                      title={currentCard.title}
                      subtitle={currentCard.subtitle}
                      severity={currentCard.severity}
                      primaryAction={buildPrimaryAction(currentCard)}
                      secondaryAction={buildSecondaryAction(currentCard)}
                      onDismiss={() => handleDismiss(currentCard.id)}
                      onPrev={safeIndex > 0 ? goPrev : undefined}
                      onNext={safeIndex < visibleCards.length - 1 ? goNext : undefined}
                      reducedMotion={reducedMotion}
                    />
                  </div>
                }
                onAssign={(profileId, displayName) => {
                  assignTask.mutate({
                    taskId: currentCard.entityId ?? currentCard.id,
                    assignedTo: profileId,
                    assigneeName: displayName,
                    profileId,
                  });
                  setAssigningCardId(null);
                  handleDismiss(currentCard.id);
                }}
              />
            ) : (
              <TaskSwiperCard
                id={currentCard.id}
                type={currentCard.type}
                title={currentCard.title}
                subtitle={currentCard.subtitle}
                severity={currentCard.severity}
                primaryAction={buildPrimaryAction(currentCard)}
                secondaryAction={buildSecondaryAction(currentCard)}
                onDismiss={() => handleDismiss(currentCard.id)}
                onPrev={safeIndex > 0 ? goPrev : undefined}
                onNext={safeIndex < visibleCards.length - 1 ? goNext : undefined}
                reducedMotion={reducedMotion}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Counter — bottom-right */}
      {visibleCards.length > 1 && (
        <div className="text-muted-foreground mt-2 text-right text-xs tabular-nums">
          {t("interactive.swiper_counter", {
            current: safeIndex + 1,
            total: visibleCards.length,
          })}
        </div>
      )}
    </div>
  );
}
