import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Årshjul tab active.
export default function PlanningArshjulPage() {
  redirect("/dashboard/planning?tab=year-wheel");
}
