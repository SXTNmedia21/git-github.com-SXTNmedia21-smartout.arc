import { Briefcase, Users, ShieldCheck, Crown } from "lucide-react";
import { createClient } from "@smartout/supabase/server";
import { fetchWorkspacePeople } from "@smartout/utils";
import { resolveDashboardContext } from "../../_data/resolve-page-context";

export const dynamic = "force-dynamic";

const ROLE_META = [
  { key: "owner", label: "Eier", icon: Crown },
  { key: "admin", label: "Admin", icon: ShieldCheck },
  { key: "manager", label: "Manager", icon: Briefcase },
  { key: "employee", label: "Ansatt", icon: Users },
] as const;

export default async function RolesPage() {
  const { workspace } = await resolveDashboardContext();
  const supabase = await createClient();
  const result = await fetchWorkspacePeople(supabase, workspace.workspace_id);

  // Group profiles by role; exclude 'system' from operator view.
  const byRole = new Map<string, typeof result.profiles>();
  for (const p of result.profiles) {
    if (p.role === "system") continue;
    const bucket = byRole.get(p.role) ?? [];
    bucket.push(p);
    byRole.set(p.role, bucket);
  }

  const totalCount = result.profiles.filter((p) => p.role !== "system").length;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      {/* Page header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-foreground text-3xl leading-tight tracking-tight">
            Roller
          </h1>
          <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Rolle-fordeling i workspace</span>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span className="font-mono tabular-nums">{totalCount} ansatte</span>
          </div>
        </div>
      </div>

      {/* KPI strip — count per role */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {ROLE_META.map((meta) => {
          const count = byRole.get(meta.key)?.length ?? 0;
          const Icon = meta.icon;
          return (
            <div
              key={meta.key}
              className="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm"
              data-role-key={meta.key}
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
                <span className="text-muted-foreground text-[11px] font-bold tracking-widest uppercase">
                  {meta.label}
                </span>
              </div>
              <div className="font-mono text-[36px] leading-none font-black tracking-tight tabular-nums">
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Body — per-role profile listings */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {ROLE_META.map((meta) => {
            const profiles = byRole.get(meta.key) ?? [];
            if (profiles.length === 0) return null;
            return (
              <section
                key={meta.key}
                className="bg-card border-border rounded-2xl border p-5 shadow-sm"
                aria-label={`Rolle: ${meta.label}`}
              >
                <h2 className="text-foreground mb-3 text-sm font-bold tracking-tight">
                  {meta.label}{" "}
                  <span className="text-muted-foreground font-mono font-normal tabular-nums">
                    ({profiles.length})
                  </span>
                </h2>
                <ul className="space-y-1.5">
                  {profiles.map((p) => (
                    <li
                      key={p.profile_id}
                      className="text-foreground text-sm"
                      data-profile-id={p.profile_id}
                    >
                      {p.display_name || p.user_identity?.email || "Ukjent"}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
