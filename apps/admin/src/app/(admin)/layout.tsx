/**
 * layout.tsx — (admin) route group
 *
 * Server-side accountant-role assertion. Wraps all protected routes
 * in the AdminShell with sidebar + topbar.
 * requireAccountant() returns { userId, companyIds } or redirects/404s.
 */
import { requireAccountant } from "@/lib/accountant";
import { AdminShell } from "./_components/AdminShell";
import { AdminSidebarNav } from "./_components/AdminSidebarNav";
import { AdminTopbar } from "./_components/AdminTopbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Throws redirect("/auth/login") if no session.
  // Throws notFound() if authed but no active grants.
  const { userId, companyIds } = await requireAccountant();

  return (
    <AdminShell>
      <AdminSidebarNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar userId={userId} companyCount={companyIds.length} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </AdminShell>
  );
}
