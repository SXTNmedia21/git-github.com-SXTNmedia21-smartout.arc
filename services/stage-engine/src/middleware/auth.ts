// ============================================
// auth.ts
// Dual-auth middleware for the Stage Engine.
// Supports two auth methods:
//   1. x-api-key header → SHA-256 hash lookup against platform_api_key
//   2. Authorization: Bearer <jwt> → Supabase Auth getUser()
// The resolved auth context is stored in c.set("auth", ...) for route handlers.
// Connected to: src/lib/supabase.ts (admin client for key lookup)
// Connected to: src/lib/crypto.ts (SHA-256 hashing)
// Connected to: DECISIONS.md D14, D15 (auth decisions)
// ============================================

import type { Context, Next } from "hono";
import { supabaseAdmin, createUserClient } from "../lib/supabase.js";
import { hashApiKey } from "../lib/crypto.js";
import type { AuthContext } from "../types/auth.js";

/**
 * Middleware that authenticates requests using API key or JWT.
 * Skips auth for the /health endpoint.
 * On success, sets c.set("auth", authContext) for downstream handlers.
 * On failure, returns 401 with error details.
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  // Health endpoint is public
  if (c.req.path === "/health") {
    return next();
  }

  const apiKey = c.req.header("x-api-key");
  const authHeader = c.req.header("authorization");

  // Try API key first
  if (apiKey) {
    const auth = await validateApiKey(apiKey);
    if (auth) {
      c.set("auth", auth);
      return next();
    }
    return c.json({ error: "AUTH_FAILED", message: "Invalid API key", status: 401 }, 401);
  }

  // Try JWT
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const auth = await validateJwt(token);
    if (auth) {
      c.set("auth", auth);
      return next();
    }
    return c.json({ error: "AUTH_FAILED", message: "Invalid or expired JWT", status: 401 }, 401);
  }

  return c.json(
    { error: "AUTH_FAILED", message: "Missing x-api-key or Authorization header", status: 401 },
    401,
  );
}

/**
 * Validates an API key by hashing it and looking up the hash
 * in the platform_api_key table via service role.
 *
 * @param key - Raw API key from x-api-key header
 * @returns AuthContext if valid, null if invalid
 */
async function validateApiKey(key: string): Promise<AuthContext | null> {
  const hash = hashApiKey(key);

  const { data, error } = await supabaseAdmin
    .from("platform_api_key")
    .select("workspace_id, scopes, environment")
    .eq("key_hash", hash)
    .eq("version", "current")
    .single();

  if (error || !data) {
    return null;
  }

  return {
    method: "api_key",
    workspaceId: data.workspace_id,
    scopes: data.scopes ?? [],
  };
}

/**
 * Validates a JWT by calling Supabase Auth getUser().
 * Then looks up the user's workspace from their profile.
 *
 * @param token - JWT from Authorization: Bearer header
 * @returns AuthContext if valid, null if invalid
 */
async function validateJwt(token: string): Promise<AuthContext | null> {
  const client = createUserClient(token);

  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) {
    return null;
  }

  // Get user's first active workspace (for workspace context)
  const { data: profile } = await supabaseAdmin
    .from("profile")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (!profile) {
    return null;
  }

  return {
    method: "jwt",
    workspaceId: profile.workspace_id,
    userId: user.id,
  };
}
