/**
 * Platform Admin — Email Suppression List
 *
 * Server component that gates access, fetches initial data,
 * and passes it to the client-side interactive table.
 */

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { SuppressionsClient } from "./_components/suppressions-client";

type SuppressionRow = {
  suppression_id: string;
  email: string;
  reason: string;
  source: string | null;
  created_at: string | null;
};

export default async function SuppressionsPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();

  const { data, count } = await admin
    .from("platform_email_suppression" as never)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(50);

  const suppressions = (data ?? []) as unknown as SuppressionRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Email Suppressions</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          View and manage suppressed email addresses. Suppressed addresses will not receive any
          platform communications.
        </p>
      </div>

      <SuppressionsClient initialData={suppressions} initialTotal={count ?? 0} />
    </div>
  );
}
