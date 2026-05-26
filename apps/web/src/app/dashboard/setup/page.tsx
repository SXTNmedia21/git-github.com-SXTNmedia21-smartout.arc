"use client";

/**
 * Dashboard Setup page — thin shell that renders AnimatedWizardShell.
 *
 * This page does NOT own any business logic or workspace state mutations.
 * All flag updates (setup_guide_completed), K1b ingestion triggers, and
 * redirects live in wizard-definition.ts onComplete — keeping this page
 * as a pure render wrapper with zero runtime truth ownership.
 *
 * Harness bridge:
 *   SetupToolsBridge registers Botsson tools for this surface.
 *   Wizard state (currentStepIndex, completedSteps) is lifted via onContextChange.
 *   openStep navigates via ?step= URL param — loadState respects it on remount.
 */

import { Suspense, useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Loader2, SkipForward } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardSetupWizard } from "./wizard-definition";
import { useWizardBotssonContext } from "@/app/Botsson/_hooks/useWizardBotssonContext";
import { SetupToolsBridge } from "./_tools/setup-tools-bridge";
import type { WizardContextPayload } from "@smartout/ui";
import type { SetupState } from "./types";

export default function DashboardSetupPage() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("dashboard");
  const { handleContextChange } = useWizardBotssonContext();
  const searchParams = useSearchParams();

  /* ── Harness state — lifted from AnimatedWizardShell via onContextChange ── */
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<ReadonlySet<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  /* ── View-emit (axis-12 page-polish, L-0177 fail-fast guard) ──────────────
   * Fires once when workspace_id + profileId are both non-empty.
   * completedSteps initial value is 0 (wizard not yet loaded); this reflects
   * the state at page-open, not mid-session. */
  const wizardViewedRef = useRef(false);
  useEffect(() => {
    const workspaceId = workspace.workspace_id;
    if (!workspaceId || !profileId || wizardViewedRef.current) return;
    wizardViewedRef.current = true;
    void emit({
      event: "setup.wizard_viewed",
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(profileId, "actor_id"),
      properties: {
        entity: {
          entity_type: "workspace",
          entity_id: workspaceId,
          entity_label: "Setup Wizard",
        },
        data: {
          steps_completed: 0,
          total_steps: 9,
        },
      },
    });
  }, [workspace.workspace_id, profileId]);

  const handleContextChangeWithLift = useCallback(
    (ctx: WizardContextPayload) => {
      setCurrentStepIndex(ctx.stepIndex);
      setCompletedSteps(new Set(ctx.completedSteps));
      setIsLoading(false);
      handleContextChange(ctx);
    },
    [handleContextChange],
  );

  /* ── Step override from ?step= URL param (used by openStep tool) ── */
  const requestedStepId = searchParams?.get("step") ?? null;

  const STEP_IDS = [
    "welcome",
    "document-drop",
    "governance",
    "payroll",
    "employment",
    "team",
    "shift-template",
    "season",
    "handbook",
  ] as const;

  const stepOverrideIndex = useMemo(() => {
    if (!requestedStepId) return undefined;
    const idx = STEP_IDS.indexOf(requestedStepId as (typeof STEP_IDS)[number]);
    return idx >= 0 ? idx : undefined;
  }, [requestedStepId]);

  /* ── Derived wizard definition with optional step override ── */
  const wizardDefinition = useMemo(() => {
    if (stepOverrideIndex === undefined) return dashboardSetupWizard;
    const originalLoadState = dashboardSetupWizard.loadState;
    return {
      ...dashboardSetupWizard,
      loadState: async (): Promise<Partial<SetupState>> => {
        const base = originalLoadState ? await originalLoadState() : {};
        return {
          ...base,
          _initialStepIndex: stepOverrideIndex,
        } as Partial<SetupState> & { _initialStepIndex?: number };
      },
    };
  }, [stepOverrideIndex]);

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="text-muted-foreground animate-spin" size={32} />
        </div>
      }
    >
      {/* Harness bridge — registers Botsson tools for this surface */}
      <SetupToolsBridge
        currentStepIndex={currentStepIndex}
        completedSteps={completedSteps}
        isLoading={isLoading}
      />

      <div className="relative flex h-full flex-col">
        {/* Escape hatch — skip to dashboard (session-only, resets on reload) */}
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => {
              // Two-layer flag: server layout reads the cookie (skips its 307
              // redirect), client DashboardShell reads sessionStorage (skips its
              // window.location.href redirect at DashboardShell.tsx:1070-1075).
              // Cookie TTL 1 day; sessionStorage clears on tab close — both
              // intentional so reload re-arms setup if still incomplete.
              document.cookie = "setup_dismissed=1; path=/; max-age=86400; samesite=lax";
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
          definition={wizardDefinition}
          workspaceId={workspace.workspace_id}
          actorId={profileId ?? "anonymous"}
          onContextChange={handleContextChangeWithLift}
        />
      </div>
    </Suspense>
  );
}
