import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateApiKey } from "./api-key-auth.ts";

export type AuthMethod = "jwt" | "api_key";

export interface AuthContext {
  method: AuthMethod;
  userId: string | null;
  workspaceId: string | null;
  scopes: string[];
  keyId: string | null;
  rateLimitKey: string;
  rateLimitPerMinute: number;
  environment: "live" | "test" | null;
}

export async function resolveAuth(req: Request): Promise<AuthContext | null> {
  // Strategy 1: API key header
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) {
    const keyCtx = await validateApiKey(apiKey);
    if (!keyCtx) return null;
    return {
      method: "api_key",
      userId: null,
      workspaceId: keyCtx.workspaceId,
      scopes: keyCtx.scopes,
      keyId: keyCtx.keyId,
      rateLimitKey: `key:${keyCtx.keyId}`,
      rateLimitPerMinute: keyCtx.rateLimitPerMinute,
      environment: keyCtx.environment,
    };
  }

  // Strategy 2: Bearer token (could be API key or JWT)
  const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
  if (bearer) {
    // If it looks like a Smartout API key, validate as such
    if (bearer.startsWith("smo_")) {
      const keyCtx = await validateApiKey(bearer);
      if (!keyCtx) return null;
      return {
        method: "api_key",
        userId: null,
        workspaceId: keyCtx.workspaceId,
        scopes: keyCtx.scopes,
        keyId: keyCtx.keyId,
        rateLimitKey: `key:${keyCtx.keyId}`,
        rateLimitPerMinute: keyCtx.rateLimitPerMinute,
        environment: keyCtx.environment,
      };
    }

    // Otherwise treat as JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${bearer}` } } },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const workspaceId = req.headers.get("x-workspace-id");
    return {
      method: "jwt",
      userId: user.id,
      workspaceId: workspaceId ?? null,
      scopes: ["*"],
      keyId: null,
      rateLimitKey: `user:${user.id}`,
      rateLimitPerMinute: 120,
      environment: null,
    };
  }

  return null;
}

export function hasScope(auth: AuthContext, required: string): boolean {
  if (auth.method === "jwt") return true;
  return auth.scopes.includes(required) || auth.scopes.includes("*");
}
