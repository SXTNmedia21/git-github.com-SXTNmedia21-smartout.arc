"use client";

// InlineTaskCreator — collapsible mini-form for creating tasks directly on the dashboard.
// Resolves the active or upcoming department_session automatically so the manager
// does not need to navigate to the session view just to add a task.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignPopover } from "./AssignPopover";
import { useCreateQuickTask } from "@/app/dashboard/_hooks";

// Ambient spring — Nordic Split spec
const AMBIENT_SPRING = {
  type: "spring" as const,
  stiffness: 40,
  damping: 22,
  mass: 2.2,
};

type Props = {
  mode: "operative" | "preparatory";
  profileId: string;
};

/** Returns tomorrow's date as YYYY-MM-DD string. */
function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
}

/**
 * InlineTaskCreator — collapsed "+ Ny oppgave" button that expands into a mini-form.
 *
 * Why: Task creation is the most common preparatory action, but opening a full
 * modal for it breaks flow. This component keeps the manager in context.
 */
export function InlineTaskCreator({ profileId }: Props) {
  const { t } = useTranslation("dashboard");
  const { workspace } = useWorkspace();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<{ profileId: string; name: string } | null>(null);
  const [dueDate, setDueDate] = useState(tomorrowDate);

  const createTask = useCreateQuickTask();

  // Resolve the active or soonest upcoming department_session for this workspace.
  // Active session takes precedence; if none, use the earliest upcoming session.
  const { data: sessionId, isLoading: sessionLoading } = useQuery({
    queryKey: ["dashboard", "resolved-session", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();

      // Prefer an active session
      const { data: active } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (active) return active.department_session_id;

      // Fall back to the earliest upcoming session
      const { data: upcoming } = await supabase
        .from("department_session")
        .select("department_session_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "upcoming")
        .order("session_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      return upcoming?.department_session_id ?? null;
    },
  });

  const hasSession = !!sessionId && !sessionLoading;

  function handleSubmit() {
    if (!title.trim() || !sessionId) return;

    createTask.mutate(
      {
        title: title.trim(),
        department_session_id: sessionId,
        assigned_to: assignedTo?.profileId,
        due_date: dueDate,
        profileId,
      },
      {
        onSuccess: () => {
          setTitle("");
          setAssignedTo(null);
          setDueDate(tomorrowDate());
          setIsExpanded(false);
        },
      },
    );
  }

  return (
    <div>
      {/* Collapsed trigger */}
      {!isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          disabled={!hasSession && !sessionLoading}
        >
          <Plus className="h-4 w-4" />
          <span>{t("interactive.prep_new_task")}</span>
        </button>
      )}

      {/* Expanded form */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="task-creator"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: AMBIENT_SPRING }}
            exit={{ height: 0, opacity: 0, transition: AMBIENT_SPRING }}
            className="overflow-hidden"
          >
            <div className="bg-card border-border space-y-3 rounded-xl border p-3">
              {/* No session guard */}
              {!hasSession && !sessionLoading && (
                <p className="text-muted-foreground text-xs">{t("interactive.prep_no_session")}</p>
              )}

              {hasSession && (
                <>
                  {/* Title input */}
                  <Input
                    placeholder={t("interactive.prep_task_title")}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsExpanded(false);
                    }}
                  />

                  {/* Assign + due date row */}
                  <div className="flex items-center gap-2">
                    {/* Assign popover */}
                    <AssignPopover
                      trigger={
                        <Button variant="outline" size="sm" className="h-8 text-xs">
                          {assignedTo ? assignedTo.name : t("interactive.prep_task_assign")}
                        </Button>
                      }
                      onAssign={(pid, name) => setAssignedTo({ profileId: pid, name })}
                    />

                    {/* Due date picker */}
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      aria-label={t("interactive.prep_task_due")}
                      className="border-border bg-background text-foreground focus:ring-ring h-8 rounded-md border px-2 text-xs focus:ring-1 focus:outline-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handleSubmit}
                      disabled={!title.trim() || createTask.isPending}
                      className="h-7 text-xs"
                    >
                      {t("interactive.prep_task_submit")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsExpanded(false)}
                      className="h-7 text-xs"
                    >
                      {/* Cancel — no explicit i18n key required; using a simple × */}✕
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
