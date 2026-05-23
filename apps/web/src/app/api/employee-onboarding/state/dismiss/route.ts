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
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
