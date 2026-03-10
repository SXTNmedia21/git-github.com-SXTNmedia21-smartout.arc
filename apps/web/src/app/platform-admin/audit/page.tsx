import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { AuditListClient } from "@/components/platform-admin/audit-list-client";
import type { AuditRow } from "@/components/platform-admin/audit-columns";

const getAuditData = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("platform_audit_log")
      .select(
        `id, action, entity_type, entity_id, details, created_at,
         admin:super_admin_id (first_name, last_name)`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    return data;
  },
  ["platform-admin-audit-v1"],
  { revalidate: 30 },
);

export default async function AuditPage() {
  const [adminId, auditLogs] = await Promise.all([getSuperAdminId(), getAuditData()]);
  if (!adminId) redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <p className="text-muted-foreground mt-1 text-sm">All super-admin actions</p>
      <div className="mt-6">
        <AuditListClient data={(auditLogs as unknown as AuditRow[]) || []} />
      </div>
    </div>
  );
}
