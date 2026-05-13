/**
 * Derives the task_type for the universal TaskModal based on MyTaskRow data.
 *
 * MyTaskRow (ADR-0298) uses normalized field names:
 *   compliance               (was: is_compliance_required)
 *   hook_id                  (was: session_hook_id)
 *   hook_linked_procedure_id (from fn_list_my_tasks v2, Sortie 3 §4.10)
 *   hook_linked_routine_id   (from fn_list_my_tasks v2, Sortie 3 §4.10)
 *
 * All five task types are now fully resolved from RPC output. This is the
 * single source of truth for which form component renders in TaskModal.
 */

/** The five task types that drive the TaskModal form switch */
export type TaskType = "haccp" | "checklist" | "confirmation" | "procedure" | "general";

/**
 * Minimal shape of a task row with hook metadata.
 * The hook is nullable because not all tasks originate from a hook.
 *
 * hook_linked_procedure_id and hook_linked_routine_id are wired by
 * fn_list_my_tasks v2 (Phase 3, Sortie 3 §4.10). Both are nullable — null
 * means the hook is not linked to a procedure or routine respectively.
 */
export type TaskWithHook = {
  /** True for HACCP/legally-required compliance tasks. */
  compliance: boolean;
  /** Populated when the task originates from a session_hook. */
  hook_id: string | null;
  /** Populated when the session_hook links to a procedure (step-by-step form). */
  hook_linked_procedure_id: string | null;
  /** Populated when the session_hook links to a routine (checklist form). */
  hook_linked_routine_id: string | null;
};

/**
 * Resolves the task type for a given task row.
 *
 * Priority order (first match wins):
 * 1. compliance → haccp       (HACCP/legally-required; temperature logging)
 * 2. hook_linked_procedure_id → procedure  (step-by-step procedure form)
 * 3. hook_linked_routine_id   → checklist  (routine/checklist form)
 * 4. hook_id                  → confirmation (generic hook confirmation)
 * 5. (no hook, no compliance) → general   (freeform task)
 */
export function resolveTaskType(task: TaskWithHook): TaskType {
  /* HACCP tasks are compliance-critical — always identified first */
  if (task.compliance) {
    return "haccp";
  }

  /* Hook linked to a procedure → step-by-step procedure form */
  if (task.hook_linked_procedure_id) {
    return "procedure";
  }

  /* Hook linked to a routine → checklist form */
  if (task.hook_linked_routine_id) {
    return "checklist";
  }

  /* Hook exists but no linked procedure/routine → generic confirmation */
  if (task.hook_id) {
    return "confirmation";
  }

  /* No hook, no compliance flag — general freeform task */
  return "general";
}
