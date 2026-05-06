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
        <div className="z-10 flex-1 overflow-y-auto px-10 pt-8 pb-20">
          <div className="mb-6">
            <h1 className="text-foreground mb-2 flex items-center gap-3 text-3xl font-extrabold tracking-tight">
              Active Pipeline
              <span className="rounded border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-xs font-bold tracking-wider text-orange-600 uppercase">
                LIVE
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Real-time status of today&apos;s operational department sessions.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {/* Task Percentage */}
            <MetricCard
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
              title="Tasks Out"
              value="8"
              sub="Currently pending"
              icon={Activity}
              color="text-muted-foreground"
              bg="bg-muted"
              border="border-border"
            />
          </div>

          <div className="border-border bg-card flex flex-col rounded-2xl border p-6 shadow-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-foreground text-xl font-extrabold">
                  Register vs Staff Cost (Hour by Hour)
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Live comparison of revenue generated against active payroll costs.
                </p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-emerald-500" />
                  <span className="text-muted-foreground text-sm font-semibold">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm bg-red-400" />
                  <span className="text-muted-foreground text-sm font-semibold">Staff Cost</span>
                </div>
              </div>
            </div>

            {/* Mock Bar Chart */}
            <div className="relative mt-4 flex h-64 items-end gap-2">
              {/* Y-Axis lines */}
              <div className="border-border absolute top-0 w-full border-t border-dashed" />
              <div className="border-border absolute top-1/4 w-full border-t border-dashed" />
              <div className="border-border absolute top-2/4 w-full border-t border-dashed" />
              <div className="border-border absolute top-3/4 w-full border-t border-dashed" />

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
                  className="group hover:bg-accent relative z-10 flex flex-1 flex-col items-center gap-2 rounded-xl pt-2 pb-1 transition-colors"
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
                  <span className="text-muted-foreground group-hover:text-accent-foreground text-xs font-bold">
                    {col.time}
                  </span>

                  {/* Hover tooltip conceptual */}
                  <div className="bg-popover text-popover-foreground pointer-events-none absolute -top-10 z-20 rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
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
      <div className="z-10 flex flex-1 flex-col overflow-y-auto px-10 pt-8 pb-20">
        <div className="mb-6">
          <h1 className="text-foreground mb-2 text-3xl font-extrabold tracking-tight">
            {activeTab} Overview
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage and view your {activeTab.toLowerCase()} data here.
          </p>
        </div>

        <div className="border-border bg-muted/50 flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-colors">
          <div className="bg-muted mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Activity className="text-muted-foreground h-8 w-8" />
          </div>
          <h2 className="text-foreground mb-2 text-xl font-bold">
            {activeTab} is under construction!
          </h2>
          <p className="text-muted-foreground max-w-sm text-center">
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
    <div className="bg-background text-foreground flex min-h-screen flex-col overflow-hidden font-sans transition-colors duration-300 selection:bg-orange-500/30">
      {/* TOP CONTEXT BAR (As defined in Architecture) */}
      <header className="border-border bg-card relative z-30 flex h-14 items-center justify-between border-b px-6 shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-6">
          <div className="bg-muted hover:bg-accent flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors">
            <Building2 className="h-4 w-4 text-orange-500" />
            <span className="text-foreground text-sm font-bold">Bårdshaug Vegkro</span>
            <ChevronRight className="text-muted-foreground h-3.5 w-3.5 rotate-90" />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Season:</span>
            <span className="text-foreground font-semibold">Vinter 2026</span>
            <div className="ml-2 flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Active</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDark(!isDark)}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md p-1.5 transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="group flex cursor-pointer items-center gap-3">
            <div className="text-right">
              <p className="text-foreground text-sm leading-tight font-semibold">Anna Olsen</p>
              <p className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Admin
              </p>
            </div>
            <div className="border-border bg-muted flex h-8 w-8 items-center justify-center rounded-full border">
              <span className="text-foreground text-xs font-bold">AO</span>
            </div>
            <ChevronRight className="text-muted-foreground group-hover:text-accent-foreground h-4 w-4 rotate-90 transition-colors" />
          </div>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR NAVIGATION */}
        <aside className="border-border bg-card z-20 flex w-64 flex-col border-r shadow-sm transition-colors duration-300">
          <nav className="relative flex-1 space-y-1 overflow-y-auto px-4 py-8">
            {isAdminMode ? (
              <>
                <div className="text-muted-foreground mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase">
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

                <div className="text-muted-foreground mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase">
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

                <div className="text-muted-foreground mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase">
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
                <div className="text-muted-foreground mt-2 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase">
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

            <div className="text-muted-foreground mt-6 mb-3 px-3 text-[10px] font-bold tracking-widest uppercase">
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

          <div className="border-border bg-muted/50 border-t p-4">
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
                  : "border-border bg-card text-foreground shadow-sm"
              }`}
            >
              <span>{isAdminMode ? "Admin Mode" : "Employee Mode"}</span>
              <div
                className={`flex h-4 w-8 items-center rounded-full p-0.5 transition-colors ${isAdminMode ? "bg-orange-500" : "bg-muted-foreground"}`}
              >
                <div
                  className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${isAdminMode ? "translate-x-4" : "translate-x-0"}`}
                />
              </div>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="bg-background relative flex h-full flex-1 flex-col overflow-hidden transition-colors duration-300">
          {/* ACTION BAR */}
          <div className="border-border bg-card/90 sticky top-0 z-10 flex h-16 items-center justify-between border-b px-10 shadow-sm backdrop-blur-md transition-colors duration-300">
            <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
              <span className="hover:text-accent-foreground cursor-pointer transition-colors">
                {isAdminMode ? "Operations" : "Workspace"}
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="border-border bg-background text-foreground rounded-md border px-2.5 py-1 font-semibold shadow-sm">
                {activeTab}
              </span>
            </div>

            <div className="flex items-center gap-5">
              <div className="group relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transition-colors group-focus-within:text-orange-500" />
                <input
                  type="text"
                  placeholder="Search operations..."
                  className="border-border bg-background text-foreground placeholder:text-muted-foreground hover:bg-accent w-64 rounded-lg border py-2 pr-4 pl-9 text-sm shadow-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {renderMainContent()}
        </main>
      </div>
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
          ? "border-border bg-accent text-accent-foreground border font-bold"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={`h-[18px] w-[18px] transition-colors ${
            ai
              ? "text-indigo-500 group-hover:text-indigo-400"
              : active
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-accent-foreground"
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
}

function MetricCard({ title, value, sub, icon: Icon, color, bg, border, pulse }: MetricCardProps) {
  return (
    <div className="border-border bg-card hover:bg-accent flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          {title}
        </h3>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg border ${bg} ${border}`}
        >
          <Icon className={`h-4 w-4 ${color} ${pulse ? "animate-pulse" : ""}`} />
        </div>
      </div>
      <div>
        <div className="text-foreground mb-1.5 text-2xl leading-none font-black tracking-tight">
          {value}
        </div>
        <div className="text-muted-foreground text-[10px] font-semibold">{sub}</div>
      </div>
    </div>
  );
}
