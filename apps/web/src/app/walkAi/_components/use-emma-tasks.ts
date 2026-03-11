"use client";

// use-emma-tasks.ts
// Checks for triggered tasks on mount (page load / login).
// Returns pending missions so the WalkAi provider can feed them to Emma.

import { useCallback, useEffect, useState } from "react";

export type EmmaTriggeredTask = {
  id: string;
  title: string;
  description: string;
  context: Record<string, unknown>;
  mission: string | null;
  due_at: string | null;
  triggered_at: string;
};

export function useEmmaTriggeredTasks() {
  const [tasks, setTasks] = useState<EmmaTriggeredTask[]>([]);
  const [checked, setChecked] = useState(false);

  // Check on mount
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/emma/tasks");
        if (!res.ok) return;
        const data = await res.json() as { tasks: EmmaTriggeredTask[] };
        if (!cancelled && data.tasks?.length > 0) {
          setTasks(data.tasks);
        }
      } catch {
        // Silent — non-critical
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    void check();
    return () => { cancelled = true; };
  }, []);

  // Dismiss a task after Emma has handled it
  const dismissTask = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch("/api/emma/tasks/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });
    } catch {
      // Silent
    }
  }, []);

  return { triggeredTasks: tasks, checked, dismissTask };
}
