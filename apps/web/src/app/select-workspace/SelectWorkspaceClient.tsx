"use client";

/**
 * SelectWorkspaceClient — client-side picker for /select-workspace.
 *
 * Renders the WorkspaceCard grid + the stale-onboarding section, handles
 * workspace selection, and performs the post-selection routing rules:
 *   1. If welcome hasn't been shown AND user signed up < 24h ago → /welcome
 *      (server writes `user_metadata.welcome_shown_at` inside /welcome)
 *   2. Otherwise → navigate to the workspace subdomain /dashboard
 *
 * Workspace switching uses the existing pattern — redirect to the workspace
 * subdomain (production) or `/dashboard?ws=<id>` (local dev). Middleware sets
 * `x-workspace-slug` from the subdomain so downstream code resolves the right
 * workspace. We do NOT invent a new switching mechanism.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";
import { WorkspaceCard } from "@/components/auth/WorkspaceCard";
import { ArchiveOnboardingButton } from "./ArchiveOnboardingButton";

type WorkspaceRow = {
  workspace_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  onboarding_completed: boolean;
  role: string;
  displayName: string | null;
};

type Props = {
  userEmail: string;
  workspaces: WorkspaceRow[];
  staleWorkspaces: WorkspaceRow[];
  rootDomain: string;
  isProduction: boolean;
  /** True when we should route the first click through /welcome. */
  shouldShowWelcome: boolean;
};

function translateRole(role: string): string {
  const mapping: Record<string, string> = {
    owner: "Eier",
    admin: "Admin",
    manager: "Leder",
    employee: "Ansatt",
    trainee: "Lærling",
  };
  return mapping[role.toLowerCase()] ?? role;
}

function workspaceHref(
  slug: string,
  workspaceId: string,
  rootDomain: string,
  isProduction: boolean,
  withWelcome: boolean,
): string {
  if (isProduction) {
    return `https://${slug}.${rootDomain}${withWelcome ? "/welcome" : "/dashboard"}`;
  }
  // Local dev fallback: keep on portal and use ?ws= param (dashboard layout honours it).
  return withWelcome ? `/welcome?ws=${workspaceId}` : `/dashboard?ws=${workspaceId}`;
}

export function SelectWorkspaceClient({
  userEmail,
  workspaces,
  staleWorkspaces,
  rootDomain,
  isProduction,
  shouldShowWelcome,
}: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSelect(ws: WorkspaceRow) {
    if (isPending) return;
    setSelectedId(ws.workspace_id);
    startTransition(() => {
      const href = workspaceHref(
        ws.slug,
        ws.workspace_id,
        rootDomain,
        isProduction,
        shouldShowWelcome,
      );
      if (isProduction) {
        window.location.href = href;
      } else {
        router.push(href);
      }
    });
  }

  const hasAny = workspaces.length > 0 || staleWorkspaces.length > 0;
  const hasSingle = workspaces.length === 1 && staleWorkspaces.length === 0;

  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      {/* Ambient warm orb — single, bottom-right, subtle */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-[-15%] bottom-[-20%] h-[60vh] w-[60vh] rounded-full opacity-[0.12] blur-[140px]"
        style={{ backgroundColor: "var(--brand-orange-warm)" }}
      />

      {/* Header */}
      <header className="border-border/40 relative z-10 flex items-center justify-between border-b px-6 py-4">
        <Image
          src="/smartout-logo.png"
          alt="Smartout"
          width={112}
          height={38}
          className="opacity-90"
          priority
        />
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground hidden text-sm sm:block">{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-brand-orange/40 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Logg ut
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col items-center px-6 py-12 lg:py-20">
        <div className="w-full max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.8 }}
            className="mb-10 text-center"
          >
            <h1 className="font-heading text-foreground text-[2.25rem] leading-[1.05] tracking-tight sm:text-[2.75rem]">
              {hasAny ? "Velg arbeidsflate" : "Velkommen til Smartout"}
            </h1>
            <p className="text-muted-foreground mt-3 text-base">
              {hasAny
                ? "Velg hvor du vil jobbe i dag."
                : "Du er ikke medlem av noen arbeidsflater ennå."}
            </p>
            {hasSingle && (
              <p className="text-muted-foreground/70 mt-2 text-sm">Trykk for å fortsette.</p>
            )}
          </motion.div>

          {hasAny ? (
            <>
              {/* Active workspaces — responsive grid */}
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                }}
              >
                {workspaces.map((ws, i) => (
                  <motion.div
                    key={ws.workspace_id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 70,
                      damping: 18,
                      mass: 0.8,
                      delay: i * 0.08,
                    }}
                  >
                    <WorkspaceCard
                      workspaceName={ws.name}
                      workspaceSlug={ws.slug}
                      userRole={translateRole(ws.role)}
                      active={selectedId === ws.workspace_id}
                      onClick={() => handleSelect(ws)}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Stale onboarding */}
              {staleWorkspaces.length > 0 && (
                <motion.section
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="border-border/40 mt-10 border-t pt-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Uferdig onboarding ({staleWorkspaces.length})
                    </p>
                    <ArchiveOnboardingButton
                      workspaceIds={staleWorkspaces.map((ws) => ws.workspace_id)}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {staleWorkspaces.map((ws) => (
                      <div
                        key={ws.workspace_id}
                        className="border-border/40 bg-background/60 flex items-center gap-3 rounded-xl border border-dashed p-4 opacity-70"
                      >
                        <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold">
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground/70 truncate text-sm">{ws.name}</p>
                          <p className="text-muted-foreground truncate text-xs">Ikke fullført</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Create new workspace link */}
              <div className="mt-10 flex justify-center">
                <Link
                  href="/onboarding"
                  className="text-brand-orange hover:text-brand-orange/80 text-sm font-medium transition-colors"
                >
                  + Opprett ny arbeidsflate
                </Link>
              </div>
            </>
          ) : (
            /* Empty state */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 70, damping: 18 }}
              className="border-border bg-background/80 mx-auto max-w-md rounded-2xl border p-8 text-center shadow-sm"
            >
              <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                Ingen arbeidsflater ennå. Be en admin om å invitere deg — eller opprett din egen.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/onboarding"
                  className="bg-brand-orange inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                >
                  Opprett arbeidsflate
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Logg ut
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
