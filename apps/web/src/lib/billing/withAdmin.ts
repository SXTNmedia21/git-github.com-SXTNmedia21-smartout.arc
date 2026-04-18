import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";
import type { AdminActionResult } from "@smartout/billing";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { createClient } from "@smartout/supabase/server";

// Fase 3A B0 — Admin auth-gate wrappers for billing Server Actions.
//
// Why this exists:
//   Fase 2 has ~15 platform-admin Server Actions that each repeat the same
//   5-line pattern (getSuperAdminId → unauthorized bail → createAdminClient
//   → delegate → emit). Fase 3A adds another ~15-20 actions across Stripe
//   payments + dunning opt-out + refund flows. Without a wrapper, that's a
//   lot of boilerplate to drift out of sync.
//
// What these do:
//   withPlatformAdmin(fn)  — gates on is_godmode, hands fn an adminId +
//                            service-role client. fn returns an
//                            AdminActionResult, which we pass through.
//   withWorkspaceAdmin(ws, fn) — gates on is_admin_in_workspace(user, ws),
//                                same shape.
//
// What they do NOT do:
//   - Zod validation (the caller owns that; wrappers stay auth-only)
//   - emit() (the caller owns telemetry — the wrapper has no idea what event
//     to emit or what payload to build)
//   - revalidatePath (the caller owns the cache invalidation scope)
//
// The wrappers are deliberately thin: auth is the only cross-cutting concern
// that every billing admin action shares. Validation, emit, and revalidate
// are all action-specific and live in the caller.
//
// Mobile parity: the shared result shape lives in @smartout/billing/_shared.
// Mobile never crosses Next.js; it calls the pure action functions directly
// and builds its own auth gate. The wrappers here are web-only.

type BillingClient = SupabaseClient<Database>;

/**
 * Gate a Server Action handler on platform-admin (godmode) authorisation.
 *
 * Returns { ok: false, error: 'unauthorized', code: 'not_platform_admin' }
 * if the caller is not a godmode user. Otherwise invokes `fn` with the
 * authenticated user's UUID and a service-role Supabase client.
 *
 * Usage from a Server Action file:
 *
 *   export async function createPaymentAction(input: unknown) {
 *     "use server";
 *     return withPlatformAdmin(async (adminId, client) => {
 *       const parsed = CreatePaymentInputSchema.safeParse(input);
 *       if (!parsed.success) {
 *         return { ok: false, error: "invalid_input", code: "invalid_input" };
 *       }
 *       const result = await createPayment(client, parsed.data);
 *       // emit + revalidate here (wrapper does not)
 *       return result.ok
 *         ? { ok: true, data: result.payment }
 *         : { ok: false, error: result.error };
 *     });
 *   }
 */
export async function withPlatformAdmin<T>(
  fn: (adminUserId: string, client: BillingClient) => Promise<AdminActionResult<T>>,
): Promise<AdminActionResult<T>> {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return { ok: false, error: "unauthorized", code: "not_platform_admin" };
  }
  const client = createAdminClient();
  return fn(adminId, client);
}

/**
 * Gate a Server Action handler on workspace-admin authorisation.
 *
 * Checks is_admin_in_workspace(user.id, workspace_id) via a JWT-scoped
 * Supabase call (NOT the service-role client — RLS must reject
 * non-members). If the caller is a workspace admin, invokes `fn` with the
 * user's UUID and a service-role client (so the handler can perform the
 * actual work without RLS friction now that the gate has passed).
 *
 * Returns { ok: false, error: 'unauthorized', code: 'not_workspace_admin' }
 * for any non-admin caller.
 *
 * Note: We intentionally pass the service-role client to `fn`. The gate
 * has already verified membership; using the admin client inside the
 * handler matches the platform-admin pattern and avoids the need for the
 * handler to know which client to use. The handler is responsible for
 * scoping its queries to the provided workspace_id.
 */
export async function withWorkspaceAdmin<T>(
  workspace_id: string,
  fn: (userId: string, client: BillingClient) => Promise<AdminActionResult<T>>,
): Promise<AdminActionResult<T>> {
  const jwtClient = await createClient();
  const {
    data: { user },
  } = await jwtClient.auth.getUser();

  if (!user) {
    return { ok: false, error: "unauthorized", code: "not_workspace_admin" };
  }

  // is_admin_in_workspace is a SECURITY DEFINER function — it reads
  // company_member/workspace directly and returns a boolean. Calling it via
  // the JWT client ensures we cannot smuggle a different user.
  const { data: isAdmin, error } = await jwtClient.rpc("is_admin_in_workspace", {
    uid: user.id,
    wid: workspace_id,
  });

  if (error || !isAdmin) {
    return { ok: false, error: "unauthorized", code: "not_workspace_admin" };
  }

  const adminClient = createAdminClient();
  return fn(user.id, adminClient);
}
