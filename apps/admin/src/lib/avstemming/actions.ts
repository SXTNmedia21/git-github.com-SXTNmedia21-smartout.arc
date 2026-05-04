"use server";

/**
 * apps/admin/src/lib/avstemming/actions.ts — avstemming server actions.
 *
 * runSettlement: orchestrates the full settlement pipeline for an accountant.
 *   - Resolves authenticated user + active company grants.
 *   - If workspace_ids not provided → all granted workspaces.
 *   - Delegates to executeSettlementRun (packages/billing/server/settlement).
 *   - Emits run_initiated before the run, run_completed / run_failed after.
 *
 * ⛔ NEVER bypass the requireAccountant() gate — every call must pass.
 * ⛔ NEVER return serviceClient or raw service-role key from this action.
 * ⛔ NEVER auto-trigger settlement — must be an explicit user action.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAccountant } from "@/lib/accountant";
import { fetchWorkspacesForCompanies } from "@smartout/billing";
import { executeSettlementRun } from "@smartout/billing/server/settlement";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { RunSettlementResult } from "@smartout/billing/server/settlement";

// Type aliases not re-exported here — Next.js 16 "use server" files only
// permit async function exports. Consumers needing these types should
// import directly from @smartout/billing/server/settlement.
type RunSettlementInput = {
  period_start: string; // "2026-09-01"
  period_end: string; // "2026-09-30"
  workspace_ids?: string[]; // if omitted → all granted workspaces
};

/**
 * Run the full settlement pipeline for a given period.
 *
 * Access flow:
 *  1. requireAccountant() — validates session + active grants, returns userId + companyIds.
 *  2. If workspace_ids not provided → fetch all granted workspaces from all companies.
 *  3. Emit run_initiated telemetry.
 *  4. executeSettlementRun — handles access re-verification, DB writes, artifact generation.
 *  5. On result → emit run_completed or run_failed.
 *  6. Return result or throw with friendly message.
 *
 * @throws {Error} On invalid input, access denied, or unrecoverable run failure.
 */
export async function runSettlement(
  input: FormData | RunSettlementInput,
): Promise<RunSettlementResult> {
  // Normalise FormData → plain object.
  let parsedInput: RunSettlementInput;
  if (input instanceof FormData) {
    const period_start = input.get("period_start");
    const period_end = input.get("period_end");
    if (!period_start || !period_end) {
      throw new Error("period_start og period_end er påkrevd");
    }
    const wsIds = input.getAll("workspace_ids").map(String).filter(Boolean);
    parsedInput = {
      period_start: String(period_start),
      period_end: String(period_end),
      workspace_ids: wsIds.length > 0 ? wsIds : undefined,
    };
  } else {
    parsedInput = input;
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  const { userId, companyIds } = await requireAccountant();

  // ── Resolve workspace scope ──────────────────────────────────────────────
  let workspaceIds: string[];

  if (parsedInput.workspace_ids && parsedInput.workspace_ids.length > 0) {
    workspaceIds = parsedInput.workspace_ids;
  } else {
    // No scope provided → all granted workspaces across all companies.
    const userClient = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allWorkspaces = await fetchWorkspacesForCompanies(userClient as any, companyIds);
    workspaceIds = allWorkspaces.map((ws) => ws.workspace_id);
  }

  if (workspaceIds.length === 0) {
    throw new Error("Ingen tilgjengelige workspaces for denne perioden");
  }

  // ── Execute run ───────────────────────────────────────────────────────────
  const serviceClient = createAdminClient();
  const userClient = await createClient();

  try {
    const result = await executeSettlementRun(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      serviceClient as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userClient as any,
      userId,
      {
        period_start: parsedInput.period_start,
        period_end: parsedInput.period_end,
        workspace_ids: workspaceIds,
        scope:
          parsedInput.workspace_ids && parsedInput.workspace_ids.length > 0
            ? "single_workspace"
            : "all_workspaces",
      },
    );

    // ── Emit run_initiated ────────────────────────────────────────────────────
    // Emitted AFTER executeSettlementRun so we have the real run_id from the
    // settlement_run INSERT. Prior placement (before the call) used
    // entity_id: "pending" — a non-UUID string that corrupts audit entity refs
    // (same R1 class as kartotek_viewed fix in M7c closure).
    //
    // Trade-off: if executeSettlementRun throws before inserting the run row,
    // run_initiated is never emitted. This is acceptable because run_failed
    // (emitted inside executeSettlementRun) covers that path.
    void emit({
      event: "settlement run_initiated",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "settlement_run", entity_id: result.run_id },
        data: {
          period_start: parsedInput.period_start,
          period_end: parsedInput.period_end,
          workspace_count: workspaceIds.length,
          scope:
            parsedInput.workspace_ids && parsedInput.workspace_ids.length > 0
              ? "single_workspace"
              : "all_workspaces",
        },
      },
    }).catch(console.error); // Non-fatal — do not block return.

    // run_completed / run_failed telemetry is emitted inside executeSettlementRun.
    // The server action does not re-emit to avoid duplicate events.

    if (result.status === "failed") {
      throw new Error(result.error ?? "Avstemming feilet — se logg for detaljer");
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ukjent feil under avstemming";
    // Re-throw with a user-friendly prefix if not already formatted.
    throw new Error(
      message.startsWith("access_denied")
        ? "Ingen tilgang: du har ikke grants for alle valgte workspaces"
        : message,
    );
  }
}
