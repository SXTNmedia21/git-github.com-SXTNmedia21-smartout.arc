"use client";

/**
 * pos-accounts-tools-bridge.tsx — registers Botsson read-only tools for
 * /dashboard/admin/pos-accounts under scope "admin-pos-accounts".
 *
 * Why a bridge:
 *  - Keeps PosAccountsList clean from voice-tool registration logic.
 *  - Receives a serialized snapshot of account state — no raw Supabase types.
 *  - Returns null; only side-effect is tool registration/unregistration.
 *
 * ADR-0244: read-only tools only — no mutation tools registered here.
 * ADR-0077: props exclude oauth_token / refresh_token — booleans + names + dates only.
 * ADR-0238: /admin/pos-accounts does not own a domain chat surface.
 * ADR-0151: workspace_id never passed as a prop — resolved server-side via RLS.
 */

import { useRegisterTools } from "@/app/Botsson/_components/tool-registry";
import { usePosAccountsTools } from "./use-pos-accounts-tools";
import type { PosAccountsToolInput } from "./use-pos-accounts-tools";

export function PosAccountsToolsBridge({ accounts, workspaceIsActive }: PosAccountsToolInput) {
  const tools = usePosAccountsTools({ accounts, workspaceIsActive });

  useRegisterTools("admin-pos-accounts", tools);

  return null;
}
