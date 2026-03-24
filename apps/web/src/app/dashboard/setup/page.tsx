"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { WorkspaceSetupWizard } from "@/components/dashboard/WorkspaceSetupWizard";

export default function SetupPage() {
  const { isDark } = useContext(DashboardContext);
  const router = useRouter();

  return <WorkspaceSetupWizard onComplete={() => router.push("/dashboard")} force />;
}
