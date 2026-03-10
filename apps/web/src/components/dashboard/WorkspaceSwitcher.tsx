"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Check } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

type WorkspaceOption = {
  workspace_id: string;
  name: string;
  slug: string;
  onboarding_completed: boolean;
};

export function WorkspaceSwitcher({ isDark }: { isDark: boolean }) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Fetch workspaces when dropdown opens
  useEffect(() => {
    if (!open) return;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profiles } = await supabase
        .from("profile")
        .select("workspace_id")
        .eq("user_id", user.id);

      if (!profiles?.length) return;

      const ids = profiles.map((p) => p.workspace_id);
      const { data: ws } = await supabase
        .from("workspace")
        .select("workspace_id, name, slug, onboarding_completed")
        .in("workspace_id", ids)
        .eq("onboarding_completed", true)
        .order("name");

      if (ws) setWorkspaces(ws as WorkspaceOption[]);
    }

    load();
  }, [open, supabase]);

  function switchTo(ws: WorkspaceOption) {
    setOpen(false);
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
    if (rootDomain && rootDomain !== "localhost") {
      window.location.assign(`https://${ws.slug}.${rootDomain}/dashboard`);
    } else {
      router.push(`/dashboard?ws=${ws.workspace_id}`);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
          isDark
            ? "bg-card hover:bg-accent"
            : "bg-[oklch(0.95_0.004_55)] ring-1 ring-[oklch(0.90_0.005_50)] hover:bg-[oklch(0.93_0.005_55)]"
        }`}
      >
        <Building2 className="h-4 w-4 text-orange-500" />
        <span
          className={`text-sm font-bold ${isDark ? "text-foreground" : "text-[oklch(0.25_0.01_50)]"}`}
        >
          {workspace.name}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""} ${
            isDark ? "text-muted-foreground" : "text-[oklch(0.52_0.02_50)]"
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full left-0 z-50 mt-2 min-w-[240px] rounded-xl border p-1.5 shadow-xl ${
            isDark ? "border-border bg-card" : "border-[oklch(0.90_0.005_50)] bg-white"
          }`}
        >
          <p
            className={`px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase ${
              isDark ? "text-muted-foreground" : "text-[oklch(0.52_0.02_50)]"
            }`}
          >
            Workspaces
          </p>
          {workspaces.map((ws) => {
            const isCurrent = ws.workspace_id === workspace.workspace_id;
            return (
              <button
                key={ws.workspace_id}
                type="button"
                onClick={() => !isCurrent && switchTo(ws)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                  isCurrent
                    ? isDark
                      ? "bg-accent"
                      : "bg-[oklch(0.95_0.004_55)]"
                    : isDark
                      ? "hover:bg-accent"
                      : "hover:bg-[oklch(0.96_0.003_55)]"
                }`}
              >
                <div className="bg-brand-orange/10 text-brand-orange flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold">
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium ${
                      isDark ? "text-foreground" : "text-[oklch(0.25_0.01_50)]"
                    }`}
                  >
                    {ws.name}
                  </p>
                  <p
                    className={`truncate text-xs ${
                      isDark ? "text-muted-foreground" : "text-[oklch(0.52_0.02_50)]"
                    }`}
                  >
                    {ws.slug}
                  </p>
                </div>
                {isCurrent && <Check className="h-4 w-4 shrink-0 text-orange-500" />}
              </button>
            );
          })}
          {workspaces.length === 0 && (
            <p className="text-muted-foreground px-3 py-2 text-xs">Laster...</p>
          )}
        </div>
      )}
    </div>
  );
}
