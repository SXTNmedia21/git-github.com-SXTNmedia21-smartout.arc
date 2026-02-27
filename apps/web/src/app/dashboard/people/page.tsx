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
        .from('invitation')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceData.workspace_id)
        .eq('status', 'pending');

      if (count !== null) {
        setPendingInvitesCount(count);
      }
    }

    fetchPendingInvites();
  }, [workspaceData?.workspace_id]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 md:gap-6">

      {/* Overview Metric Cards */}
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 transition-all duration-500 ease-in-out origin-top ${isCompact ? 'h-0 opacity-0 overflow-hidden mb-[-16px] md:mb-[-24px]' : 'h-[104px] opacity-100 mb-0 md:mb-2'}`}>
        <div className={`${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'} border rounded-2xl p-5 relative overflow-hidden group`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-colors" />
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-orange-50 border-orange-100 text-orange-600'}`}>
              <Users className="w-4 h-4" />
            </div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total Staff</h3>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>24</span>
            <span className="text-sm font-medium text-emerald-500 mb-0.5">+2 this month</span>
          </div>
        </div>

        <div className={`${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'} border rounded-2xl p-5 relative overflow-hidden group`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <Star className="w-4 h-4" />
            </div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Active Now</h3>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>8</span>
            <span className={`text-sm font-medium mb-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>clocked in</span>
          </div>
        </div>

        <div className={`${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200'} border rounded-2xl p-5 relative overflow-hidden group`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <div className={`p-2 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Avg Readiness</h3>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <span className={`text-3xl font-bold leading-none ${isDark ? 'text-white' : 'text-zinc-900'}`}>84%</span>
            <span className={`text-sm font-medium mb-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>workspace</span>
          </div>
        </div>

        <div className={`${isDark ? 'bg-zinc-950 border-zinc-800/50' : 'bg-white border-zinc-200 hover:border-zinc-300'} border rounded-2xl p-5 relative overflow-hidden group cursor-pointer transition-colors`}>
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-colors" />
          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500">
                <Mail className="w-4 h-4" />
              </div>
              <h3 className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>Pending Invites</h3>
            </div>
          </div>
          <div className="flex items-end gap-2 relative z-10">
            <span className="text-3xl font-bold text-rose-400 leading-none">{pendingInvitesCount}</span>
            <span className={`text-sm font-medium mb-0.5 ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>awaiting signup</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 min-h-0 flex flex-col relative">
        <PeopleDataTable onScrollChange={(isDown) => setIsCompact(isDown)} isCompact={isCompact} />
      </div>
    </div >
  );
}