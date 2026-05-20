import { redirect } from "next/navigation";

// Deep-link shim — Kalender is the default tab; redirect to parent.
export default function PlanningKalenderPage() {
  redirect("/dashboard/planning");
}
