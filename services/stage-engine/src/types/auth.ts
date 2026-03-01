// ============================================
// auth.ts
// Type definitions for auth context.
// The auth middleware attaches this to every authenticated request.
// Connected to: src/middleware/auth.ts (sets these values)
// ============================================

/**
 * Auth context attached to every authenticated request.
 * Contains the resolved identity and auth method used.
 */
export type AuthContext = {
  /** How the request was authenticated */
  method: "api_key" | "jwt";

  /** Workspace this request is scoped to */
  workspaceId: string;

  /** Supabase auth user ID (available for JWT auth) */
  userId?: string;

  /** API key scopes (available for API key auth) */
  scopes?: string[];
};
