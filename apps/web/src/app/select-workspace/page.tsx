import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@smartout/supabase/server";

export default async function SelectWorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  type ProfileRow = {
    profile_id: string;
    role: string;
    display_name: string;
    workspace_id: string;
  };
  type WorkspaceRow = { workspace_id: string; name: string; slug: string; logo_url: string | null };

  const { data: profiles } = (await supabase
    .from("profile")
    .select("profile_id, role, display_name, workspace_id")
    .eq("user_id", user.id)) as { data: ProfileRow[] | null };

  const workspaceIds = (profiles ?? []).map((p) => p.workspace_id);

  const { data: workspaceRows } =
    workspaceIds.length > 0
      ? ((await supabase
          .from("workspace")
          .select("workspace_id, name, slug, logo_url")
          .in("workspace_id", workspaceIds)) as { data: WorkspaceRow[] | null })
      : { data: [] as WorkspaceRow[] };

  const workspaces = (profiles ?? [])
    .map((p) => {
      const ws = (workspaceRows ?? []).find((w) => w.workspace_id === p.workspace_id);
      return ws ? { ...ws, role: p.role, displayName: p.display_name } : null;
    })
    .filter(Boolean) as {
    workspace_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    role: string;
    displayName: string | null;
  }[];

  // Single workspace: redirect directly
  if (workspaces.length === 1) {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    const ws = workspaces[0]!;
    if (rootDomain && rootDomain !== "localhost") {
      redirect(`https://${ws.slug}.${rootDomain}/dashboard`);
    }
    redirect("/dashboard");
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const isProduction = rootDomain !== "localhost";

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-3xl font-black text-white">Mine workspaces</h1>
        <p className="mb-8 text-zinc-400">Velg en workspace for å komme i gang.</p>

        <div className="grid gap-4">
          {workspaces.map((ws) => {
            const href = isProduction ? `https://${ws.slug}.${rootDomain}/dashboard` : "/dashboard";

            return (
              <Link
                key={ws.workspace_id}
                href={href}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-black text-white">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{ws.name}</p>
                  <p className="text-sm text-zinc-500">
                    {ws.slug}.{rootDomain} &middot; {ws.role}
                  </p>
                </div>
                <span className="text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>

        {workspaces.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-zinc-400">Du har ingen workspaces ennå.</p>
          </div>
        )}
      </div>
    </div>
  );
}
