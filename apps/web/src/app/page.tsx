"use client";

import { useState } from "react";
import {
  Users,
  Calendar,
  ChevronRight,
  LayoutDashboard,
  Search,
  Settings,
  Activity,
  TrendingUp,
  Sun,
  Moon,
  Percent,
  Gauge,
  CalendarDays,
  ShieldCheck,
  Gamepad2,
  MessageSquare,
  Bot,
  HelpCircle,
  Building2,
  GraduationCap,
  Banknote,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";

export default function SmartoutDashboardDraft() {
  const [isDark, setIsDark] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [activeTab, setActiveTab] = useState("Dashboard");

  const renderMainContent = () => {
    if (activeTab === "Live Operations") {
      return (
        <div className="custom-scrollbar z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
          <div className="mb-6">
            <h1
              className={`mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              Active Pipeline
              <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs font-bold tracking-wider text-orange-600 uppercase">
                LIVE
              </span>
            </h1>
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Real-time status of today&apos;s operational department sessions.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {/* Task Percentage */}
            <MetricCard
              isDark={isDark}
              title="Completion"
              value="68%"
              sub="15 / 22 tasks done"
              icon={Percent}
              color="text-emerald-500"
              bg={isDark ? "bg-emerald-500/10" : "bg-emerald-50"}
              border={isDark ? "border-emerald-500/20" : "border-emerald-200"}
            />
            {/* Stress Level */}
            <MetricCard
              isDark={isDark}
              title="Stress Level"
              value="High"
              sub="85% capacity. 1 short."
              icon={Gauge}
              color="text-red-500"
              bg={isDark ? "bg-red-500/10" : "bg-red-50"}
              border={isDark ? "border-red-500/20" : "border-red-200"}
              pulse
            />
            {/* Overdue Tasks */}
            <MetricCard
              isDark={isDark}
              title="Overdue Tasks"
              value="2"
              sub="Requires attention"
              icon={AlertCircle}
              color="text-orange-500"
              bg={isDark ? "bg-orange-500/10" : "bg-orange-50"}
              border={isDark ? "border-orange-500/20" : "border-orange-200"}
            />
            {/* Upcoming Tasks */}
            <MetricCard
              isDark={isDark}
              title="Upcoming Tasks"
              value="5"
              sub="Next 2 hours"
              icon={Clock}
              color="text-blue-500"
              bg={isDark ? "bg-blue-500/10" : "bg-blue-50"}
              border={isDark ? "border-blue-500/20" : "border-blue-200"}
            />
            {/* Staff Checked In */}
            <MetricCard
              isDark={isDark}
              title="Staff Present"
              value="4 / 5"
              sub="Anna, Erik, Lise, Ole"
              icon={Users}
              color="text-purple-500"
              bg={isDark ? "bg-purple-500/10" : "bg-purple-50"}
              border={isDark ? "border-purple-500/20" : "border-purple-200"}
            />
            {/* Active Tasks */}
            <MetricCard
              isDark={isDark}
              title="Tasks Out"
              value="8"
              sub="Currently pending"
              icon={Activity}
              color="text-zinc-500"
              bg={isDark ? "bg-zinc-800" : "bg-zinc-100"}
              border={isDark ? "border-zinc-700" : "border-zinc-200"}
            />
          </div>

          <div
            className={`flex flex-col rounded-2xl border p-6 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2
                  className={`text-xl font-extrabold ${isDark ? "text-zinc-100" : "text-zinc-800"}`}
                >
                  Register vs Staff Cost (Hour by Hour)
                </h2>
                <p className={`mt-1 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Live comparison of revenue generated against active payroll costs.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                  <span
                    className={`text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                  >
                    Revenue
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-red-400" />
                  <span
                    className={`text-sm font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                  >
                    Staff Cost
                  </span>
                </div>
              </div>
            </div>

            {/* Mock Bar Chart */}
            <div className="relative mt-4 flex h-64 items-end gap-2">
              {/* Y-Axis lines */}
              <div
                className={`absolute top-0 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-1/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-2/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />
              <div
                className={`absolute top-3/4 w-full border-t border-dashed ${isDark ? "border-zinc-800" : "border-zinc-200"}`}
              />

              {/* Columns */}
              {[
                { time: "10:00", rev: "30%", cost: "40%" },
                { time: "11:00", rev: "45%", cost: "40%" },
                { time: "12:00", rev: "85%", cost: "50%" },
                { time: "13:00", rev: "95%", cost: "60%" },
                { time: "14:00", rev: "60%", cost: "50%" },
                { time: "15:00", rev: "35%", cost: "40%" },
                { time: "16:00", rev: "10%", cost: "20%", future: true },
                { time: "17:00", rev: "0%", cost: "0%", future: true },
                { time: "18:00", rev: "0%", cost: "0%", future: true },
              ].map((col, idx) => (
                <div
                  key={idx}
                  className="group relative z-10 flex flex-1 flex-col items-center gap-2 rounded-xl pt-2 pb-1 transition-colors hover:bg-zinc-500/5"
                >
                  <div className="flex h-48 w-full items-end justify-center gap-1.5 opacity-90 transition-opacity hover:opacity-100">
                    <div
                      className={`w-1/3 rounded-t-md shadow-sm transition-all ${col.future ? (isDark ? "border border-emerald-900/30 bg-emerald-900/20" : "border border-emerald-200/50 bg-emerald-100/50") : "bg-emerald-500 group-hover:bg-emerald-400"}`}
                      style={{ height: col.rev }}
                    />
                    <div
                      className={`w-1/3 rounded-t-md shadow-sm transition-all ${col.future ? (isDark ? "border border-red-900/30 bg-red-900/20" : "border border-red-200/50 bg-red-100/50") : "bg-red-400 group-hover:bg-red-300"}`}
                      style={{ height: col.cost }}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold ${isDark ? "text-zinc-500 group-hover:text-zinc-300" : "text-zinc-400 group-hover:text-zinc-700"}`}
                  >
                    {col.time}
                  </span>

                  {/* Hover tooltip conceptual */}
                  <div className="pointer-events-none absolute -top-10 z-20 rounded bg-zinc-800 px-2 py-1 text-[10px] whitespace-nowrap text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                    Rev: {col.rev} | Cost: {col.cost}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="custom-scrollbar z-10 flex flex-1 flex-col overflow-y-auto px-10 pt-8 pb-20">
        <div className="mb-6">
          <h1
            className={`mb-2 text-3xl font-extrabold tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
          >
            {activeTab} Overview
          </h1>
          <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Manage and view your {activeTab.toLowerCase()} data here.
          </p>
        </div>

        <div
          className={`flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors ${
            isDark ? "border-zinc-800 bg-zinc-900/20" : "border-zinc-200 bg-zinc-50/50"
          }`}
        >
          <div
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isDark ? "bg-zinc-800" : "bg-zinc-100"}`}
          >
            <Activity className={`h-8 w-8 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
          </div>
          <h2 className={`mb-2 text-xl font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            {activeTab} is under construction!
          </h2>
          <p className={`max-w-sm text-center ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            We are currently building this section. To see a working demo of the components,
            navigate to
            <strong className="mx-1 text-orange-500">Live Operations</strong>
            in the sidebar.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex min-h-screen flex-col overflow-hidden font-sans transition-colors duration-300 selection:bg-orange-500/30 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"}`}
    >
      {/* TOP CONTEXT BAR (As defined in Architecture) */}
      <header
        className={`relative z-30 flex h-14 items-center justify-between px-6 transition-colors duration-300 ${isDark ? "border-b border-zinc-800 bg-[#0a0a0c]" : "bg-zinc-900 text-white shadow-md"}`}
      >
        <div className="flex items-center gap-6">
          <div
            className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${isDark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-800 hover:bg-zinc-700"}`}
          >
            <Building2 className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-bold text-white">Bårdshaug Vegkro</span>
            <ChevronRight className="h-3.5 w-3.5 rotate-90 text-zinc-400" />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-zinc-400">Season:</span>
            <span className="font-semibold text-white">Vinter 2026</span>
            <div className="ml-2 flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className={`rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="group flex cursor-pointer items-center gap-3">
            <div className="text-right">
              <p className="text-sm leading-tight font-semibold text-white">Anna Olsen</p>
              <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">Admin</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
              <span className="text-xs font-bold text-zinc-300">AO</span>
            </div>
            <ChevronRight className="h-4 w-4 rotate-90 text-zinc-500 transition-colors group-hover:text-white" />
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside
          className={`z-20 flex w-64 flex-col border-r transition-colors duration-300 ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white shadow-sm"}`}
        >
          <nav className="custom-scrollbar relative flex-1 space-y-1 overflow-y-auto px-4 py-8">
            {isAdminMode ? (
              <>
                <div
                  className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Management
                </div>
                <NavItem
                  icon={LayoutDashboard}
                  label="Dashboard"
                  isDark={isDark}
                  active={activeTab === "Dashboard"}
                  onClick={() => setActiveTab("Dashboard")}
                />
                <NavItem
                  icon={Users}
                  label="People"
                  isDark={isDark}
                  badge="2 Req"
                  active={activeTab === "People"}
                  onClick={() => setActiveTab("People")}
                />
                <NavItem
                  icon={CalendarDays}
                  label="Schedule"
                  isDark={isDark}
                  active={activeTab === "Schedule"}
                  onClick={() => setActiveTab("Schedule")}
                />

                <div
                  className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Operations
                </div>
                <NavItem
                  icon={Activity}
                  label="Live Operations"
                  isDark={isDark}
                  active={activeTab === "Live Operations"}
                  onClick={() => setActiveTab("Live Operations")}
                />
                <NavItem
                  icon={TrendingUp}
                  label="Reports"
                  isDark={isDark}
                  active={activeTab === "Reports"}
                  onClick={() => setActiveTab("Reports")}
                />

                <div
                  className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  Administration
                </div>
                <NavItem
                  icon={ShieldCheck}
                  label="Governance"
                  isDark={isDark}
                  active={activeTab === "Governance"}
                  onClick={() => setActiveTab("Governance")}
                />
                <NavItem
                  icon={Gamepad2}
                  label="Season"
                  isDark={isDark}
                  active={activeTab === "Season"}
                  onClick={() => setActiveTab("Season")}
                />
                <NavItem
                  icon={Building2}
                  label="Organization"
                  isDark={isDark}
                  active={activeTab === "Organization"}
                  onClick={() => setActiveTab("Organization")}
                />
              </>
            ) : (
              <>
                <div
                  className={`mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
                >
                  My Workspace
                </div>
                <NavItem
                  icon={LayoutDashboard}
                  label="Dashboard"
                  isDark={isDark}
                  active={activeTab === "Dashboard"}
                  onClick={() => setActiveTab("Dashboard")}
                />
                <NavItem
                  icon={Calendar}
                  label="My Schedule"
                  isDark={isDark}
                  active={activeTab === "My Schedule"}
                  onClick={() => setActiveTab("My Schedule")}
                />
                <NavItem
                  icon={GraduationCap}
                  label="My Training"
                  isDark={isDark}
                  badge="1 Due"
                  active={activeTab === "My Training"}
                  onClick={() => setActiveTab("My Training")}
                />
                <NavItem
                  icon={FileText}
                  label="My CV & Profile"
                  isDark={isDark}
                  active={activeTab === "My CV & Profile"}
                  onClick={() => setActiveTab("My CV & Profile")}
                />
                <NavItem
                  icon={Banknote}
                  label="My Salary"
                  isDark={isDark}
                  active={activeTab === "My Salary"}
                  onClick={() => setActiveTab("My Salary")}
                />
              </>
            )}

            <div
              className={`mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
            >
              Communication
            </div>
            <NavItem
              icon={MessageSquare}
              label="Chat"
              isDark={isDark}
              badge="3"
              active={activeTab === "Chat"}
              onClick={() => setActiveTab("Chat")}
            />
            <NavItem
              icon={Bot}
              label="Mr. Botsson"
              isDark={isDark}
              ai
              active={activeTab === "Mr. Botsson"}
              onClick={() => setActiveTab("Mr. Botsson")}
            />

            <div className="mt-8 space-y-1 pt-4">
              <NavItem
                icon={Settings}
                label="Settings"
                isDark={isDark}
                active={activeTab === "Settings"}
                onClick={() => setActiveTab("Settings")}
              />
              <NavItem
                icon={HelpCircle}
                label="Help"
                isDark={isDark}
                active={activeTab === "Help"}
                onClick={() => setActiveTab("Help")}
              />
            </div>
          </nav>

          <div
            className={`border-t p-4 ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-50/50"}`}
          >
            <button
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setActiveTab("Dashboard");
              }}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                isAdminMode
                  ? isDark
                    ? "border-orange-500/20 bg-orange-500/10 text-orange-500"
                    : "border-orange-200 bg-orange-50 text-orange-600"
                  : isDark
                    ? "border-zinc-700 bg-zinc-800 text-zinc-300"
                    : "border-zinc-200 bg-white text-zinc-700 shadow-sm"
              }`}
            >
              <span>{isAdminMode ? "Admin Mode" : "Employee Mode"}</span>
              <div
                className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${isAdminMode ? "bg-orange-500" : "bg-zinc-400"}`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${isAdminMode ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main
          className={`relative flex h-full flex-1 flex-col overflow-hidden transition-colors duration-300 ${isDark ? "bg-zinc-950" : "bg-zinc-50"}`}
        >
          {/* ACTION BAR */}
          <div
            className={`sticky top-0 z-10 flex h-16 items-center justify-between border-b px-10 transition-colors duration-300 ${isDark ? "border-zinc-900 bg-zinc-950/90" : "border-zinc-200 bg-white/90 shadow-sm backdrop-blur-md"}`}
          >
            <div
              className={`flex items-center gap-2.5 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
            >
              <span
                className={`cursor-pointer transition-colors ${isDark ? "hover:text-zinc-200" : "hover:text-zinc-900"}`}
              >
                {isAdminMode ? "Operations" : "Workspace"}
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span
                className={`rounded-md border px-2.5 py-1 font-semibold shadow-sm ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100" : "border-zinc-200 bg-white text-zinc-900"}`}
              >
                {activeTab}
              </span>
            </div>

            <div className="flex items-center gap-5">
              <div className="group relative">
                <Search
                  className={`absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors ${isDark ? "text-zinc-500 group-focus-within:text-orange-500" : "text-zinc-400 group-focus-within:text-orange-600"}`}
                />
                <input
                  type="text"
                  placeholder="Search operations..."
                  className={`w-64 rounded-lg border py-2 pr-4 pl-9 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 hover:bg-zinc-800/80 focus:border-orange-500/50 focus:ring-orange-500/50" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 hover:bg-zinc-50 focus:border-orange-500/50 focus:ring-orange-500/50"}`}
                />
              </div>
            </div>
          </div>

          {renderMainContent()}
        </main>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150,150,150,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(150,150,150,0.4); }
      `,
        }}
      />
    </div>
  );
}

interface NavItemProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  badge?: string;
  isDark?: boolean;
  ai?: boolean;
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, badge, isDark, ai, onClick }: NavItemProps) {
  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
      className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
        active
          ? isDark
            ? "border border-zinc-700/50 bg-zinc-800/80 font-semibold text-white"
            : "border border-zinc-200/50 bg-zinc-100 font-bold text-zinc-900"
          : isDark
            ? "border border-transparent text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200"
            : "border border-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-[18px] w-[18px] transition-colors ${
            ai
              ? "text-indigo-500 group-hover:text-indigo-400"
              : active
                ? isDark
                  ? "text-zinc-200"
                  : "text-zinc-800"
                : isDark
                  ? "text-zinc-500 group-hover:text-zinc-400"
                  : "text-zinc-400 group-hover:text-zinc-600"
          }`}
        />
        <span className={`text-[13px] tracking-wide ${active ? "font-bold" : "font-medium"}`}>
          {label}
        </span>
      </div>
      {active && !badge && (
        <div
          className={`h-1.5 w-1.5 rounded-full ${isDark ? "bg-orange-500 shadow-[0_0_10px_rgba(234,88,12,0.8)]" : "bg-orange-500 shadow-sm"}`}
        />
      )}
      {badge && (
        <span
          className={`rounded border px-2 py-0.5 text-[9px] font-bold ${
            isDark
              ? "border-orange-500/20 bg-orange-500/10 text-orange-400"
              : "border-orange-200 bg-orange-50 text-orange-600"
          }`}
        >
          {badge}
        </span>
      )}
    </a>
  );
}

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
  isDark?: boolean;
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  color,
  bg,
  border,
  pulse,
  isDark,
}: MetricCardProps) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all ${isDark ? "border-zinc-800/80 bg-[#121216] hover:bg-[#18181b]" : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-md"}`}
    >
      <div className="mb-3 flex items-start justify-between">
        <h3
          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
        >
          {title}
        </h3>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${bg} ${border}`}
        >
          <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-pulse" : ""}`} />
        </div>
      </div>
      <div>
        <div
          className={`mb-1.5 text-2xl leading-none font-black tracking-tight ${isDark ? "text-white" : "text-zinc-900"}`}
        >
          {value}
        </div>
        <div className={`text-[10px] font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {sub}
        </div>
      </div>
    </div>
  );
}
