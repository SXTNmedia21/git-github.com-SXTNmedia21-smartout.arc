"use client";

/**
 * Onboarding page — confirmation wizard using WizardShell.
 *
 * Loads pre-filled data from workspace.intelligence_data (populated by Join wizard)
 * and guides the user through confirming business info, departments, locations,
 * and procedures before finalizing the workspace.
 *
 * Finalization path: shell plus /onboarding finalization via
 * buildWorkspaceFinalizationRequest → finalize-workspace Edge Function.
 * This is the same canonical path used by the previous scroll-based implementation.
 * No dependence on activate-workspace — the wizard-definition.ts onComplete
 * delegates to buildWorkspaceFinalizationRequest which selects the correct EF.
 */

import { Suspense, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { AnimatedWizardShell } from "@/components/wizard/AnimatedWizardShell";
import { onboardingWizard } from "./wizard-definition";

/**
 * Resolves the authenticated user's workspace and profile IDs so that
 * telemetry emitted by the wizard shell carries real identifiers instead
 * of "anonymous" / null.  Falls back gracefully when auth is unavailable.
 */
function AnimatedWizardShellWithAuth({ definition }: { definition: typeof onboardingWizard }) {
  const [authContext, setAuthContext] = useState<{
    workspaceId: string | null;
    actorId: string;
  }>({ workspaceId: null, actorId: "anonymous" });

  useEffect(() => {
    async function resolve() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profiles } = await supabase
        .from("profile")
        .select("workspace_id, profile_id")
        .eq("user_id", user.id)
        .limit(1);

      const profile = profiles?.[0];
      if (profile) {
        setAuthContext({
          workspaceId: profile.workspace_id,
          actorId: profile.profile_id,
        });
      }
    }
    resolve();
  }, []);

  return (
    <AnimatedWizardShell
      definition={definition}
      workspaceId={authContext.workspaceId}
      actorId={authContext.actorId}
    />
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Loader2 className="text-muted-foreground animate-spin" size={32} />
        </div>
      }
    >
      <AnimatedWizardShellWithAuth definition={onboardingWizard} />
    </Suspense>
  );
}
