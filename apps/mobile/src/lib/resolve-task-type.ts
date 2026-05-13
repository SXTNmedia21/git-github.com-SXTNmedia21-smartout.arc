/**
 * Derives the task_type for the universal TaskModal based on MyTaskRow data.
 *
 * MyTaskRow (ADR-0298) uses normalized field names:
 *   compliance  (was: is_compliance_required)
 *   hook_id     (was: session_hook_id)
 *
 * hook_linked_procedure_id and hook_linked_routine_id are NOT exposed by
 * fn_list_my_tasks (deferred to Sortie 3 capability tool). Until Sortie 3
 * wires those ids, hooked tasks without compliance flag render as 'confirmation'.
 *
 * This is the single source of truth for which form component renders in TaskModal.
 */

/** The five task types that drive the TaskModal form switch */
export type TaskType = "haccp" | "checklist" | "confirmation" | "procedure" | "general";

/**
 * Minimal shape of a task row with hook metadata.
 * The hook is nullable because not all tasks originate from a hook.
 *
 * NOTE: hook_linked_procedure_id and hook_linked_routine_id are deferred to
 * Sortie 3. Until then, 'procedure' and 'checklist' types are not reached —
 * hooked tasks without compliance render as 'confirmation'.
 */
export type TaskWithHook = {
  /** True for HACCP/legally-required compliance tasks. */
  compliance: boolean;
  /** Populated when the task originates from a session_hook. */
  hook_id: string | null;
};

/**
 * Resolves the task type for a given task row.
 *
 * Priority order:
 * 1. Compliance tasks → HACCP (temperature logging is a legal requirement)
 * 2. Hook exists → confirmation (procedure/checklist resolution deferred to Sortie 3)
 * 3. No hook at all → general (freeform completion)
 */
export function resolveTaskType(task: TaskWithHook): TaskType {
  /* HACCP tasks are compliance-critical — always identified first */
  if (task.compliance) {
    return "haccp";
  }

  /* Tasks originating from a session hook — procedure/checklist resolution
     deferred to Sortie 3 (hook_linked_procedure_id not in fn_list_my_tasks). */
  if (task.hook_id) {
    return "confirmation";
  }

  /* No hook, no compliance flag — general task */
  return "general";
}
