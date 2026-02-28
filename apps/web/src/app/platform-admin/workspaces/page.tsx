import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { WorkspaceListEnhanced } from "./_components/workspace-list-enhanced";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function WorkspacesPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from("workspace")
    .select(
      `workspace_id, name, slug, is_active, created_at,
       company:company_id (company_id, name, org_number, subscription_plan, subscription_status)`,
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Arbeidssteder</h1>
          <p className="text-muted-foreground mt-1 text-sm">Alle arbeidssteder på plattformen</p>
        </div>
        <Link
          href="/platform-admin/workspaces/new"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Nytt arbeidssted
        </Link>
      </div>
      <div className="mt-6">
        <WorkspaceListEnhanced data={(workspaces ?? []) as never} />
      </div>
    </div>
  );
}
