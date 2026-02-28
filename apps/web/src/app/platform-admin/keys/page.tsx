import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { KeysPageClient } from "./_components/keys-page-client";

export default async function KeysPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return <KeysPageClient />;
}
