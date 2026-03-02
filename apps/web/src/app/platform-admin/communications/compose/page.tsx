import { redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";
import { ComposePageClient } from "./_components/compose-page-client";

export default async function ComposePage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return <ComposePageClient />;
}
