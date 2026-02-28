"use client";

import { useState, useContext, useEffect } from "react";
import { Users, Star, ShieldCheck, Mail } from "lucide-react";
import { PeopleDataTable } from "./_components/people-data-table";
import { DashboardContext } from "@/app/dashboard/layout";
import { createClient } from "@smartout/supabase/client";

export default function PeoplePage() {
  const [isCompact, setIsCompact] = useState(false);
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  useEffect(() => {
    async function fetchPendingInvites() {
      if (!workspaceData?.workspace_id) return;
      const supabase = createClient();

      const { count } = await supabase
        .from("invitation")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceData.workspace_id)
        .eq("status", "pending");

      if (count !== null) {
        setPendingInvitesCount(count);
      }
    }

    fetchPendingInvites();
  }, [workspaceData?.workspace_id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:gap-6">
      {/* Overview Metric Cards */}
      <div
        className={`grid origin-top grid-cols-1 gap-4 transition-all duration-500 ease-in-out md:grid-cols-4 ${isCompact ? "mb-[-16px] h-0 overflow-hidden opacity-0 md:mb-[-24px]" : "mb-0 h-[104px] opacity-100 md:mb-2"}`}
      >
        <div
          className={`${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"} group relative overflow-hidden rounded-2xl border p-5`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-orange-500/10 blur-2xl transition-colors group-hover:bg-orange-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-orange-100 bg-orange-50 text-orange-600"}`}
            >
              <Users className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Total Staff
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              24
            </span>
            <span className="mb-0.5 text-sm font-medium text-emerald-500">+2 this month</span>
          </div>
        </div>

        <div
          className={`${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"} group relative overflow-hidden rounded-2xl border p-5`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-colors group-hover:bg-emerald-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-emerald-100 bg-emerald-50 text-emerald-600"}`}
            >
              <Star className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Active Now
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              8
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              clocked in
            </span>
          </div>
        </div>

        <div
          className={`${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white"} group relative overflow-hidden rounded-2xl border p-5`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-blue-500/10 blur-2xl transition-colors group-hover:bg-blue-500/20" />
          <div className="relative z-10 mb-3 flex items-center gap-3">
            <div
              className={`rounded-lg border p-2 ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400" : "border-blue-100 bg-blue-50 text-blue-600"}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h3
              className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Avg Readiness
            </h3>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span
              className={`text-3xl leading-none font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              84%
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              workspace
            </span>
          </div>
        </div>

        <div
          className={`${isDark ? "border-zinc-800/50 bg-zinc-950" : "border-zinc-200 bg-white hover:border-zinc-300"} group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-colors`}
        >
          <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-rose-500/10 blur-2xl transition-colors group-hover:bg-rose-500/20" />
          <div className="relative z-10 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-rose-500">
                <Mail className="h-4 w-4" />
              </div>
              <h3
                className={`text-xs font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
              >
                Pending Invites
              </h3>
            </div>
          </div>
          <div className="relative z-10 flex items-end gap-2">
            <span className="text-3xl leading-none font-bold text-rose-400">
              {pendingInvitesCount}
            </span>
            <span
              className={`mb-0.5 text-sm font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              awaiting signup
            </span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <PeopleDataTable onScrollChange={(isDown) => setIsCompact(isDown)} isCompact={isCompact} />
      </div>
    </div>
  );
}
