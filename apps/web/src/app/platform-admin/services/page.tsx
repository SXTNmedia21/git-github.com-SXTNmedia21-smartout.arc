import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { ServicesPageClient } from "./_components/services-page-client";

export default async function ServicesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return <ServicesPageClient />;
}
