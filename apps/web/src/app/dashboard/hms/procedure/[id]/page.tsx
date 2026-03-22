"use client";

import { useContext } from "react";
import { useParams } from "next/navigation";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { ProcedureDetailTabs } from "../../_components/ProcedureDetailTabs";
import { ProcedureExperience } from "../../_components/ProcedureExperience";

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdminMode } = useContext(DashboardContext);

  return isAdminMode ? (
    <ProcedureDetailTabs procedureId={id} />
  ) : (
    <ProcedureExperience procedureId={id} />
  );
}
