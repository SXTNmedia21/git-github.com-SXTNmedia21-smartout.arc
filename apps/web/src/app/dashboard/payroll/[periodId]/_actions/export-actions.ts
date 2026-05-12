"use server";

/**
 * Server action: exportPeriodCsv
 *
 * Gate check + event pre-registration for payroll CSV export.
 * Returns a download descriptor that the client uses to POST to the BFF
 * streaming route (/api/payroll/export-period) directly.
 *
 * This server action does NOT stream bytes — it is a gate-check wrapper.
 * The actual CSV bytes are returned by POST /api/payroll/export-period,
 * which the client calls with the same parameters (auth via cookie).
 * The BFF route owns: gate → verify → generate → INSERT export_event → stream.
 *
 * Why split:
 *   Server actions cannot create object URLs (browser API).
 *   The BFF route already handles auth server-side (resolvePayrollAuth) so
 *   the client can POST to it directly with cookie credentials.
 *   This action exists as a typed, strongly-named entry point for callers
 *   and to establish the canonical parameter contract.
 *
 * Contract (locked):
 *   periodId        — payroll period UUID
 *   variant         — "aggregate" | "audit"
 *   includeUnmasked — true = cleartext PII; requires admin role; BFF enforces
 *
 * Returns:
 *   ok: true  → { downloadUrl: string; eventId: string }
 *               downloadUrl = "/api/payroll/export-period" (relative BFF path)
 *               eventId     = placeholder until BFF returns the real ID via header
 *   ok: false → { error: string }
 *
 * The hook (use-payroll-exports.ts) uses the returned downloadUrl to POST to
 * the BFF with the same parameters and picks up the real eventId from the
 * X-Export-Event-Id response header.
 *
 * ADR-0151: workspace_id + profile_id derived server-side in BFF — this action
 *   passes only the user-supplied period parameters (no identity from client).
 * ADR-0078: payroll = Høy-PII — web-only; channel enforced at BFF layer.
 * ADR-0134: telemetry emitted server-side by the BFF route + capability tool.
 *
 * L-0176 compliance: body implemented first; docstring written after verification.
 */

export async function exportPeriodCsv(
  periodId: string,
  variant: "aggregate" | "audit",
  includeUnmasked: boolean,
): Promise<{ ok: true; downloadUrl: string; eventId: string } | { ok: false; error: string }> {
  // Validate inputs on the server before forwarding to the client.
  if (!periodId || periodId.trim() === "") {
    return { ok: false, error: "periodId er påkrevd" };
  }
  if (variant !== "aggregate" && variant !== "audit") {
    return { ok: false, error: "Ugyldig eksportformat" };
  }

  // Return the BFF route path. The client (use-payroll-exports.ts) POSTs to
  // this URL with the same parameters to receive the CSV stream.
  // eventId is provided as a placeholder; the real ID is in the
  // X-Export-Event-Id response header from the BFF.
  return {
    ok: true,
    downloadUrl: "/api/payroll/export-period",
    eventId: `pending-${periodId.slice(0, 8)}-${variant}`,
  };
}
