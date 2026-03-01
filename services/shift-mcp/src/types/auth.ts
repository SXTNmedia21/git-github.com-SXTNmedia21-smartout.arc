// ============================================
// auth.ts
// Auth context type shared across middleware and tool handlers.
// Two auth methods: API key (SHA-256 hash lookup) or JWT (Supabase Auth).
// Connected to: src/middleware/auth.ts (populates this context)
// Connected to: src/server.ts (tool handlers read this context)
// ============================================

export type AuthContext = {
  method: "api_key" | "jwt";
  workspaceId: string;
  /** Only present for JWT auth — the authenticated user's ID */
  userId?: string;
  /** Only present for API key auth — granted scopes */
  scopes?: string[];
};
