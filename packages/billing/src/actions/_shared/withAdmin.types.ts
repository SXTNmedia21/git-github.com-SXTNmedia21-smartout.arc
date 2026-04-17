// Shared result shape for admin-gated billing Server Actions.
//
// Fase 3A B0: the `withPlatformAdmin()` + `withWorkspaceAdmin()` wrappers
// (defined in apps/web/src/lib/billing/withAdmin.ts — Next.js-bound) both
// return this shape. Kept in packages/billing so mobile consumers of the
// future React Native adapters can share the same success/error discriminant.
//
// Mobile parity: mobile invokes pure action functions directly and will never
// cross the Next.js boundary; it builds its own auth gate. But the RESULT
// shape stays identical so UI code (web or native) can discriminate with one
// branch.

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// Common error codes emitted by the wrappers. Handlers may return additional
// action-specific codes in the union — this is a non-exhaustive guide for
// callers and tests.
export type AdminActionErrorCode =
  | "unauthorized"
  | "not_platform_admin"
  | "not_workspace_admin"
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "internal_error";
