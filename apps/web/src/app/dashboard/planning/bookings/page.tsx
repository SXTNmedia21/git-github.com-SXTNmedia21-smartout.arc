import { redirect } from "next/navigation";

// Deep-link shim — redirects to Planlegging shell with Bookings tab active.
export default function PlanningBookingsPage() {
  redirect("/dashboard/planning?tab=bookings");
}
