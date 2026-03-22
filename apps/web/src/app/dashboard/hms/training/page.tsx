"use client";

import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CompetenceMatrix } from "../_components/CompetenceMatrix";
import { ProtocolList } from "@/app/dashboard/my-training/_components/ProtocolList";

export default function TrainingPage() {
  const { isAdminMode } = useContext(DashboardContext);

  // Admin sees competence matrix. Employee sees their protocol list.
  // LearnFlow is accessible via /dashboard/hms/procedure/[id] but not the default yet.
  return isAdminMode ? <CompetenceMatrix /> : <ProtocolList />;
}
