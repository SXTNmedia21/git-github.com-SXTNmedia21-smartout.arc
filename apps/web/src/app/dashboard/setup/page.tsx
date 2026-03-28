"use client";

/**
 * Dashboard Setup page — thin shell that renders AnimatedWizardShell.
 *
 * This page does NOT own any business logic or workspace state mutations.
 * All flag updates (setup_guide_completed), K1b ingestion triggers, and
 * redirects live in wizard-definition.ts onComplete — keeping this page
 * as a pure render wrapper with zero runtime truth ownership.
 */

import { Suspense, useContext } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { useTranslation } from "@smartout/i18n";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardSetupWizard } from "./wizard-definition";

export default function DashboardSetupPage() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("dashboard");

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="text-muted-foreground animate-spin" size={32} />
        </div>
      }
    >
      <div className="relative flex h-full flex-col">
        {/* Escape hatch — skip to dashboard (session-only, resets on reload) */}
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem("setup_dismissed", "1");
              window.location.href = "/dashboard";
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            {t("setup.skip_to_dashboard")}
          </button>
        </div>

        <AnimatedWizardShell
          definition={dashboardSetupWizard}
          workspaceId={workspace.workspace_id}
          actorId={profileId ?? "anonymous"}
        />
      </div>
    </Suspense>
  );
}
