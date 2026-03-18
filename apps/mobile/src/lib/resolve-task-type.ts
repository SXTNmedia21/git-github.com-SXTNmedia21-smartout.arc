/**
 * Derives the task_type for the universal TaskModal based on session_task data.
 *
 * The session_task table has no explicit task_type field — we infer it from
 * the task's origin: tasks created from session_hook inherit the hook's linked
 * protocol type (procedure → 'procedure', routine → 'checklist'). HACCP tasks
 * are identified via is_compliance_required = true. Everything else is 'general'.
 *
 * This is the single source of truth for which form component renders in TaskModal.
 */

/** The five task types that drive the TaskModal form switch */
export type TaskType = "haccp" | "checklist" | "confirmation" | "procedure" | "general";

/**
 * Minimal shape of a session_task joined with its session_hook.
 * The hook is nullable because not all tasks originate from a hook.
 */
export type TaskWithHook = {
  is_compliance_required: boolean;
  session_hook_id: string | null;
  /** Populated via join: session_hook.linked_procedure_id */
  hook_linked_procedure_id?: string | null;
  /** Populated via join: session_hook.linked_routine_id */
  hook_linked_routine_id?: string | null;
};

/**
 * Resolves the task type for a given session_task.
 *
 * Priority order:
 * 1. Compliance-required tasks → HACCP (temperature logging is a legal requirement)
 * 2. Hook with linked procedure → procedure (step-by-step execution)
 * 3. Hook with linked routine → checklist (items to check off)
 * 4. Hook without procedure or routine link → confirmation (read and confirm)
 * 5. No hook at all → general (freeform completion)
 */
export function resolveTaskType(task: TaskWithHook): TaskType {
  /* HACCP tasks are compliance-critical — always identified first */
  if (task.is_compliance_required) {
    return "haccp";
  }

  /* Tasks originating from a session hook inherit the protocol type */
  if (task.session_hook_id) {
    if (task.hook_linked_procedure_id) {
      return "procedure";
    }
    if (task.hook_linked_routine_id) {
      return "checklist";
    }
    /* Hook exists but has no procedure or routine — treat as confirmation */
    return "confirmation";
  }

  /* No hook, no compliance flag — general task */
  return "general";
}
