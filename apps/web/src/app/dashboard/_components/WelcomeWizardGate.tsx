"use client";

/**
 * WelcomeWizardGate — first-login wizard mounting point.
 *
 * Layout.tsx decides WHEN to mount this gate (based on profile.is_welcome_complete).
 * This gate is purely a thin client wrapper: it renders <WelcomeWizard> with the
 * props resolved server-side by layout (userEmail, tariffBound).
 *
 * tariffBound is resolved from payroll.workspace_settings.is_tariff_bound by layout —
 * it controls whether the Consent step (step 6) shows the tariff-agreement clause.
 */

import { WelcomeWizard } from "@/components/welcome-wizard/WelcomeWizard";

type Props = {
  userEmail: string;
  tariffBound?: boolean;
};

export function WelcomeWizardGate({ userEmail, tariffBound = false }: Props) {
  return <WelcomeWizard userEmail={userEmail} tariffBound={tariffBound} />;
}
