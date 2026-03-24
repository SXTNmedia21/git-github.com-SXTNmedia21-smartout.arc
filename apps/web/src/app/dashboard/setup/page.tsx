"use client";

/**
 * Dashboard Setup page — renders the original WorkspaceSetupWizard.
 *
 * The AnimatedWizardShell migration was reverted because the adapter pattern
 * didn't properly bridge navigation, data-fetching, and internal step callbacks.
 * The original WorkspaceSetupWizard handles all of this correctly.
 *
 * Design token cleanup (44 hardcoded colors replaced) is preserved in the step components.
 */

import { useRouter } from "next/navigation";
import { WorkspaceSetupWizard } from "@/components/dashboard/WorkspaceSetupWizard";

export default function DashboardSetupPage() {
  const router = useRouter();

  return <WorkspaceSetupWizard onComplete={() => router.push("/dashboard")} force />;
}
