/**
 * POST /api/employee-onboarding/state/dismiss
 *
 * Web BFF for dismissing the employee onboarding wizard. Cookie-auth (web only).
 *
 * Auth (ADR-0151):
 *   - Identity derived inside dismissWelcomeWizard() via resolveCurrentProfile().
 *   - Cookie session only; Bearer is not supported on this endpoint.
 *
 * Delegates entirely to the dismissWelcomeWizard Server Action, which:
 *   - Resolves identity server-side (never trusts body).
 *   - UPSERTs employee_onboarding_state with status='dismissed' + dismissed_at.
 *   - Emits "profile welcome_wizard_dismissed" (4 destinations).
 */
import { type NextRequest, NextResponse } from "next/server";
import { dismissWelcomeWizard } from "@/app/dashboard/_actions/welcome-wizard-actions";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const result = await dismissWelcomeWizard();
  if (!result.ok) {
    // Map auth-failure refusal to 401, everything else to 500.
    // dismissWelcomeWizard returns "Ikke autentisert." when resolveCurrentProfile()
    // returns null (no session / no profile row). Treating that as 500 leaks
    // server-error status for what is structurally an auth problem.
    const status = result.error === "Ikke autentisert." ? 401 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
