"use client";

/**
 * Dashboard Setup page — renders the workspace setup wizard using AnimatedWizardShell.
 *
 * Replaces the monolithic WorkspaceSetupWizard with the unified wizard shell pattern.
 * The old WorkspaceSetupWizard.tsx is kept but no longer imported from this page.
 *
 * This page does NOT mutate workspace state (onboarding_completed, activation, etc.).
 * All workspace state mutations happen inside the individual step components
 * (GovernanceSetupStep, PayrollSetupStep, etc.) which write directly to their
 * respective domain tables (policy, season, invitation, etc.).
 * The wizard shell only orchestrates navigation and telemetry.
 */

import { Suspense, useContext } from "react";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { dashboardSetupWizard } from "./wizard-definition";

export default function DashboardSetupPage() {
  const { profileId } = useContext(DashboardContext);
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id ?? null;

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <div className="text-muted-foreground text-sm">Laster oppsett...</div>
        </div>
      }
    >
      <AnimatedWizardShell
        definition={dashboardSetupWizard}
        workspaceId={workspaceId}
        actorId={profileId ?? "anonymous"}
      />
    </Suspense>
  );
}
