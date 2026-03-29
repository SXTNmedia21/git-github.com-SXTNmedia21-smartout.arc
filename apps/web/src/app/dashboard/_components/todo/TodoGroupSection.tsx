"use client";

/**
 * Renders a single cascade task group with header, progress bar, and task cards.
 * Completed groups auto-collapse. Uses spring physics for smooth animations.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { groupIcons } from "./todo-icons";
import { TodoTaskCard } from "./TodoTaskCard";
import { resolveKey } from "./translate-todo";
import type { TaskGroupSummary } from "@smartout/types";

type TodoGroupSectionProps = {
  group: TaskGroupSummary;
  index: number;
};

/** Spring for progress bar fill and badge transitions */
const swapSpring = { type: "spring" as const, stiffness: 45, damping: 22, mass: 2 };

/** Spring for group collapse/expand height transitions */
const expandSpring = { type: "spring" as const, stiffness: 30, damping: 24, mass: 2.5 };

export function TodoGroupSection({ group, index }: TodoGroupSectionProps) {
  const { t } = useTranslation("dashboard");
  const prefersReducedMotion = useReducedMotion();
  const isComplete = group.tasks.length === 0;
  const [isOpen, setIsOpen] = useState(!isComplete);
  const Icon = groupIcons[group.group];
  const progress = group.total > 0 ? group.done / group.total : 0;

  /** When user prefers reduced motion, skip springs and use instant transitions */
  const resolvedExpandSpring = prefersReducedMotion ? { duration: 0.01 } : expandSpring;
  const resolvedSwapSpring = prefersReducedMotion ? { duration: 0.01 } : swapSpring;

  /** Sort tasks by urgency: critical first, then should, then can_wait */
  const sortedTasks = useMemo(() => {
    const urgencyOrder = { critical: 0, should: 1, can_wait: 2 };
    return [...group.tasks].sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
  }, [group.tasks]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...resolvedExpandSpring, delay: prefersReducedMotion ? 0 : index * 0.06 }}
      className="space-y-3"
    >
      {/* Group header — clickable to toggle collapse */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`todo-group-${group.group}`}
        aria-label={`${t(resolveKey(group.label_key))} — ${group.done} ${t("todo.completion", { done: String(group.done), total: String(group.total) })}${group.tasks.length > 0 ? `, ${group.tasks.length} ${t("todo.pending_tasks")}` : ""}`}
        className="hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        {isComplete ? (
          <CheckCircle2 className="text-success h-5 w-5 shrink-0" />
        ) : (
          <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
        )}

        <span className="text-foreground flex-1 text-sm font-medium">
          {t(resolveKey(group.label_key))}
        </span>

        {/* Fraction display — Geist Mono */}
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {t("todo.completion", { done: String(group.done), total: String(group.total) })}
        </span>

        {/* Progress bar */}
        <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full sm:w-20">
          <motion.div
            className={`h-full rounded-full ${progress >= 1 ? "bg-success" : "bg-brand-orange"}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress }}
            transition={resolvedSwapSpring}
            style={{ transformOrigin: "left" }}
          />
        </div>

        <motion.div animate={{ rotate: isOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        </motion.div>
      </button>

      {/* Task cards — animated collapse/expand */}
      <AnimatePresence initial={false}>
        {isOpen && sortedTasks.length > 0 && (
          <motion.div
            key="task-list"
            id={`todo-group-${group.group}`}
            role="list"
            aria-label={t(resolveKey(group.label_key))}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={resolvedExpandSpring}
            className="space-y-0.5 overflow-hidden pl-8"
          >
            <AnimatePresence mode="popLayout">
              {sortedTasks.map((task, i) => (
                <TodoTaskCard key={task.id} task={task} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
