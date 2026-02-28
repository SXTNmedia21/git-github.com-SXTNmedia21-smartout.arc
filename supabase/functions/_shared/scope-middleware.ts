import { type AuthContext } from "./auth-middleware.ts";

/**
 * Check if the auth context has a required scope.
 * JWT users get full access (RLS handles their restrictions).
 * API key users must have the scope explicitly granted.
 */
export function requireScope(auth: AuthContext, scope: string): boolean {
  if (auth.method === "jwt") return true;
  return auth.scopes.includes(scope) || auth.scopes.includes("*");
}

/**
 * Check environment enforcement.
 * Test keys (smo_sk_test_*) should only access test/sandbox data.
 * This is enforced at the gateway level since the DB doesn't distinguish environments.
 *
 * Returns the environment context for the request.
 */
export function getKeyEnvironment(apiKey: string | null): "live" | "test" | "jwt" {
  if (!apiKey) return "jwt";
  if (apiKey.includes("_test_")) return "test";
  return "live";
}
