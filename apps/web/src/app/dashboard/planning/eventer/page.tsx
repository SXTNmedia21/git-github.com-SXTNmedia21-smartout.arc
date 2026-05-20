import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Eventer tab active.
export default function PlanningEventerPage() {
  redirect("/dashboard/planning?tab=events");
}
