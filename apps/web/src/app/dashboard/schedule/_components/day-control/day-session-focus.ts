// ============================================
// day-control/day-session-focus.ts
// Shared focus helpers for visible task and field highlighting in the day panel.
// Exists to keep focus matching testable outside the React tree.
// Connected to: SessionTasksTab.tsx and day-session-focus.test.ts
// ============================================

/**
 * Checks whether a task is the currently focused task.
 *
 * Why: task focus is stored in shared state and needs a stable matcher for UI styling.
 *
 * Returns: true when the task should render as focused.
 */
export function isTaskFocused(taskId: string, focusedTaskId: string | null): boolean {
  return focusedTaskId === taskId;
}

/**
 * Checks whether a specific field within a task is focused.
 *
 * Why: agent and user focus actions use the shared `fieldName:taskId` identifier format.
 *
 * Returns: true when the field for the task should render as focused.
 */
export function isTaskFieldFocused(
  taskId: string,
  focusedFieldId: string | null,
  fieldName: string,
): boolean {
  return focusedFieldId === `${fieldName}:${taskId}`;
}
