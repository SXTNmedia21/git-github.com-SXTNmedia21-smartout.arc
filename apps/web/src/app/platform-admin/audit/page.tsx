import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { AuditListClient } from "@/components/platform-admin/audit-list-client";
import type { AuditRow } from "@/components/platform-admin/audit-columns";

export default async function AuditPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: auditLogs } = await admin
    .from("platform_audit_log")
    .select(
      `id, action, entity_type, entity_id, details, created_at,
       admin:super_admin_id (first_name, last_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

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
