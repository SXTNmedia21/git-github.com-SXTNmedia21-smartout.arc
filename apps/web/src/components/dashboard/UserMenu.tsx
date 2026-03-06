"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@smartout/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, Play, Settings, Shield, User } from "lucide-react";

type UserData = {
  displayName: string;
  email: string;
  initials: string;
  isSuperAdmin: boolean;
};

type IdentityRow = {
  first_name: string;
  last_name: string;
  is_godmode: boolean;
};

export function UserMenu({ isDark }: { isDark: boolean }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;

      // Cast needed: user_identity RLS may not expose typed select to browser client
      const { data } = await supabase
        .from("user_identity")
        .select("first_name, last_name, is_godmode")
        .eq("user_id", authUser.id)
        .single();

      const identity = data as unknown as IdentityRow | null;

      const name =
        identity?.first_name && identity?.last_name
          ? `${identity.first_name} ${identity.last_name}`
          : (authUser.email?.split("@")[0] ?? "User");
      const parts = name.split(" ");
      const initials =
        parts.length >= 2
          ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
          : name.slice(0, 2).toUpperCase();

      setUser({
        displayName: name,
        email: authUser.email ?? "",
        initials,
        isSuperAdmin: identity?.is_godmode ?? false,
      });
    }

    fetchUser();
  }, []);

  const displayName = user?.displayName ?? "...";
  const initials = user?.initials ?? "..";

  if (!isMounted) {
    return (
      <button
        type="button"
        className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-800/50 focus:outline-none"
      >
        <div className="text-right">
          <p className="text-sm leading-tight font-semibold text-white">{displayName}</p>
          <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Admin</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
          <span className="text-xs font-bold text-zinc-300">{initials}</span>
        </div>
        <ChevronDown className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-white" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-zinc-800/50 focus:outline-none">
          <div className="text-right">
            <p className="text-sm leading-tight font-semibold text-white">{displayName}</p>
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
              {user?.isSuperAdmin ? "Super Admin" : "Admin"}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
            <span className="text-xs font-bold text-zinc-300">{initials}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-zinc-500 transition-colors group-hover:text-white" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={`w-56 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : ""}`}
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-zinc-400">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Innstillinger
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/my-cv" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Min profil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex items-center gap-2"
          onClick={() => {
            window.location.href = "/dashboard?autoplay=1&showcase=1";
          }}
        >
          <Play className="h-4 w-4" />
          Start walkthrough
        </DropdownMenuItem>
        {user?.isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/platform-admin" className="flex items-center gap-2 text-orange-400">
                <Shield className="h-4 w-4" />
                Platform Admin
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 text-red-400 focus:text-red-400"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut className="h-4 w-4" />
          Logg ut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
