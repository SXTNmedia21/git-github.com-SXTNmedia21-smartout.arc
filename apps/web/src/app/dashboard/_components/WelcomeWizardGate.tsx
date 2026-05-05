"use client";

/**
 * WelcomeWizardGate — first-login wizard mounting point.
 *
 * Stub for now (2026-04-30): the full wizard component lives in
 * `apps/web/src/components/welcome-wizard/` (untracked WIP). When that ships,
 * this gate becomes the lazy-loader. For now it returns null so the layout
 * compiles without bringing in the WIP surface.
 *
 * The gate is mounted from `apps/web/src/app/dashboard/layout.tsx` when
 * `profile.is_welcome_complete` is false/null — meaning the wizard should
 * surface on next dashboard render.
 */

type Props = {
  userEmail: string;
};

export function WelcomeWizardGate(_props: Props): null {
  return null;
}
