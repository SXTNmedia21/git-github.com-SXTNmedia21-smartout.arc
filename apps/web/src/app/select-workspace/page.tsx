import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@smartout/supabase/server";
import { ArchiveOnboardingButton } from "./ArchiveOnboardingButton";

// UI Events:
// - nav: /dashboard or https://{slug}.{domain}/dashboard (workspace card click)
// - nav: /onboarding (create workspace button)
// - nav: /login (redirect if not authenticated)
// - action: archive stale onboarding workspaces (bulk)

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
  type WorkspaceRow = {
    workspace_id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    onboarding_completed: boolean;
  };

  const { data: profiles } = (await supabase
    .from("profile")
    .select("profile_id, role, display_name, workspace_id")
    .eq("user_id", user.id)) as { data: ProfileRow[] | null };

  const workspaceIds = (profiles ?? []).map((p) => p.workspace_id);

  const { data: workspaceRows } =
    workspaceIds.length > 0
      ? ((await supabase
          .from("workspace")
          .select("workspace_id, name, slug, logo_url, onboarding_completed")
          .in("workspace_id", workspaceIds)) as { data: WorkspaceRow[] | null })
      : { data: [] as WorkspaceRow[] };

  const allWorkspaces = (profiles ?? [])
    .map((p) => {
      const ws = (workspaceRows ?? []).find((w) => w.workspace_id === p.workspace_id);
      return ws ? { ...ws, role: p.role, displayName: p.display_name } : null;
    })
    .filter(Boolean) as (WorkspaceRow & { role: string; displayName: string | null })[];

  // Split into onboarded vs still-in-onboarding
  const workspaces = allWorkspaces.filter((ws) => ws.onboarding_completed);
  const staleWorkspaces = allWorkspaces.filter((ws) => !ws.onboarding_completed);

  // Single active workspace: redirect directly
  if (workspaces.length === 1 && staleWorkspaces.length === 0) {
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[oklch(0.985_0.005_60)] px-4">
      {/* Ambient glow — slow breathing drift */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="animate-ambient-1 absolute -top-[40%] left-1/2 h-[80vh] w-[80vh] rounded-full bg-[oklch(0.92_0.04_55)] blur-[120px]" />
        <div className="animate-ambient-2 absolute -right-[10%] -bottom-[20%] h-[50vh] w-[50vh] rounded-full bg-[oklch(0.95_0.02_40)] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        {/* Logo */}
        <div className="animate-auth-in mb-8 text-center" style={{ animationDelay: "0ms" }}>
          <Image
            src="/smartout-logo.png"
            alt="Smartout"
            width={140}
            height={48}
            className="inline-block"
            priority
          />
        </div>

        {/* Card */}
        <div
          className="animate-auth-in border-border/60 bg-background/70 rounded-2xl border p-8 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] backdrop-blur-xl"
          style={{ animationDelay: "80ms" }}
        >
          {workspaces.length > 0 || staleWorkspaces.length > 0 ? (
            <>
              <div className="animate-auth-in mb-6" style={{ animationDelay: "140ms" }}>
                <h1 className="font-heading text-foreground text-[1.85rem] leading-tight tracking-tight">
                  Mine workspaces
                </h1>
                <p className="text-muted-foreground mt-1.5 text-[0.875rem]">
                  Velg en workspace for å komme i gang.
                </p>
              </div>

              {/* Active workspaces */}
              <div className="animate-auth-in space-y-3" style={{ animationDelay: "200ms" }}>
                {workspaces.map((ws) => {
                  const href = isProduction
                    ? `https://${ws.slug}.${rootDomain}/dashboard`
                    : `/dashboard?ws=${ws.workspace_id}`;

                  return (
                    <Link
                      key={ws.workspace_id}
                      href={href}
                      className="group border-border bg-background hover:border-brand-orange/30 flex items-center gap-4 rounded-xl border p-4 transition-all duration-200 hover:shadow-[0_0_0_3px_oklch(0.65_0.22_40/0.08)]"
                    >
                      <div className="bg-brand-orange/10 text-brand-orange flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold">
                        {ws.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-semibold">{ws.name}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {ws.slug}.{rootDomain} &middot; {ws.role}
                        </p>
                      </div>
                      <span className="text-muted-foreground/40 group-hover:text-brand-orange transition-transform duration-150 group-hover:translate-x-0.5">
                        &rarr;
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Stale onboarding workspaces */}
              {staleWorkspaces.length > 0 && (
                <div
                  className="animate-auth-in border-border/40 mt-6 border-t pt-5"
                  style={{ animationDelay: "260ms" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Uferdig onboarding ({staleWorkspaces.length})
                    </p>
                    <ArchiveOnboardingButton
                      workspaceIds={staleWorkspaces.map((ws) => ws.workspace_id)}
                    />
                  </div>
                  <div className="space-y-2">
                    {staleWorkspaces.map((ws) => (
                      <div
                        key={ws.workspace_id}
                        className="border-border/40 flex items-center gap-3 rounded-lg border border-dashed p-3 opacity-60"
                      >
                        <div className="bg-muted text-muted-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground/60 truncate text-sm">{ws.name}</p>
                          <p className="text-muted-foreground truncate text-xs">Ikke fullført</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="animate-auth-in mt-6" style={{ animationDelay: "320ms" }}>
                <Link
                  href="/onboarding"
                  className="text-brand-orange hover:text-brand-orange/80 flex w-full justify-center text-sm font-medium transition-colors duration-150"
                >
                  + Opprett ny workspace
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="animate-auth-in mb-6 text-center" style={{ animationDelay: "140ms" }}>
                <h1 className="font-heading text-foreground text-[1.85rem] leading-tight tracking-tight">
                  Velkommen til Smartout!
                </h1>
                <p className="text-muted-foreground mt-2 text-[0.875rem] leading-relaxed">
                  Du er først ute. La oss sette opp arbeidsplassen din.
                </p>
              </div>

              <div className="animate-auth-in mt-2" style={{ animationDelay: "200ms" }}>
                <Link
                  href="/onboarding"
                  className="bg-brand-orange flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_2px_12px_oklch(0.65_0.22_40/0.25)] transition-all duration-200 hover:shadow-[0_4px_20px_oklch(0.65_0.22_40/0.35)] hover:brightness-110 active:scale-[0.98]"
                >
                  Opprett workspace
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
