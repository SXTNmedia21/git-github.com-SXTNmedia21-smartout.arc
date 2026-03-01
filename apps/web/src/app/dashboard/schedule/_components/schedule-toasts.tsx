// ============================================
// schedule-toasts.tsx
// Toast notification feedback for schedule mutations.
// Now deprecated — TanStack Query mutation hooks handle their
// own toasts via onError/onSuccess callbacks.
// This file is kept as a placeholder for any custom toast
// logic that doesn't fit inside a mutation hook.
// ============================================
"use client";

// All toast logic has been moved to the individual mutation hooks:
// - use-shifts.ts: onError toasts for shift CRUD
// - use-absences.ts: onError toasts for absence CRUD
// - use-templates.ts: onError/onSuccess toasts for template operations
// - use-open-shifts.ts: onError toasts for open shift CRUD
// - use-day-content.ts: onError toasts for messages, tasks, bookings

// The old useScheduleToast() hook is no longer needed.
// Components that previously used dispatchWithToast() should now
// call the mutation hooks directly (e.g., createShift.mutate(...)).
