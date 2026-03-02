"use client";

import React, { useState } from "react";
import {
  Activity,
  Users,
  MapPin,
  Building2,
  Network,
  ChevronDown,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorkforcePipeline, useTrainingReadiness } from "@/app/dashboard/_hooks";

// Helper to generate mock heatmap data
const generateHeatmapData = (labels: string[]) => {
  return labels.map((label) => ({
    id: label.toLowerCase().replace(/\s+/g, "-"),
    label,
    data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 100)),
  }));
};

const LOCATIONS = generateHeatmapData([
  "Baardshaug Vegkro",
  "Trondheim City",
  "Oslo S Kiosk",
  "Lillehammer Diner",
  "Stavanger FNB",
]);
const DEPARTMENTS = generateHeatmapData([
  "Kjokken",
  "Servering",
  "Oppvask",
  "Renhold",
  "Lager",
  "Sikkerhet",
]);
const TEAMS = generateHeatmapData([
  "Morgenfuglene",
  "Kveldsgjengen",
  "Helgeteamet",
  "Sommervikarer",
  "VIP Catering",
]);
const EMPLOYEES = generateHeatmapData([
  "Anna Olsen",
  "Ola Nordmann",
  "Kari Svendsen",
  "Jens Hansen",
  "Bente Johansen",
  "Svein Eide",
  "Linda Bakken",
  "Per Lie",
  "Marianne Berg",
  "Knut Lunde",
]);

export function ActivityView({ isDark }: { isDark: boolean }) {
  const [activeTab, setActiveTab] = useState<"locations" | "departments" | "teams" | "employees">(
    "locations",
  );
  const [timeframe] = useState("Siste 30 dager");

  const { data: pipeline } = useWorkforcePipeline();
  const { data: training } = useTrainingReadiness();

  let activeData = LOCATIONS;
  if (activeTab === "departments") activeData = DEPARTMENTS;
  if (activeTab === "teams") activeData = TEAMS;
  if (activeTab === "employees") activeData = EMPLOYEES;

  const getIntensityClass = (val: number, dark: boolean) => {
    if (val === 0) return dark ? "bg-zinc-800/30" : "bg-zinc-100";
    if (val < 20) return dark ? "bg-indigo-500/10" : "bg-indigo-100";
    if (val < 40) return dark ? "bg-indigo-500/30" : "bg-indigo-200";
    if (val < 60) return dark ? "bg-indigo-500/50" : "bg-indigo-300";
    if (val < 80) return dark ? "bg-indigo-500/80" : "bg-indigo-400";
    return "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]";
  };

  return (
    <div className="animate-in fade-in flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {/* Header */}
      <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
        <div>
          <h1
            className={`flex items-center gap-3 text-2xl font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
          >
            <div
              className={`rounded-xl p-2 ${isDark ? "bg-indigo-500/20 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]" : "bg-indigo-100 text-indigo-600"}`}
            >
              <Activity className="h-5 w-5" />
            </div>
            Activity & Heatmap Dashboard
          </h1>
          <p className={`mt-1 max-w-2xl text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
            Visualize cross-cutting activity, load and intensity across the business.
          </p>
        </div>

        <div className="relative z-20 flex gap-2">
          <button
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
          >
            <Filter className="h-4 w-4" /> Filter
          </button>
          <button
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition-all ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
          >
            {timeframe} <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          isDark={isDark}
          title="Active Staff"
          value={pipeline ? String(pipeline.activeStaff) : "--"}
          trend={pipeline ? `+${pipeline.newHires30d} new` : ""}
          isPositive={true}
          subtitle="Currently employed"
        />
        <StatCard
          isDark={isDark}
          title="Training Readiness"
          value={training ? `${training.readinessPercent}%` : "--"}
          trend={training ? `${training.completed}/${training.totalAssignments}` : ""}
          isPositive={!training || training.readinessPercent >= 80}
          subtitle="Protocol completion"
        />
        <StatCard
          isDark={isDark}
          title="Highest Intensity"
          value="Fridays"
          trend="Kveldsgjengen"
          isPositive={true}
          subtitle="Most active"
        />
        <StatCard
          isDark={isDark}
          title="Lowest Intensity"
          value="Sunday AM"
          trend="-5.2%"
          isPositive={false}
          subtitle="Below budget threshold"
        />
      </div>

      {/* Training Progress Section */}
      {training && training.totalAssignments > 0 && (
        <div
          className={`rounded-2xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
        >
          <h3
            className={`mb-4 text-sm font-bold tracking-widest uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
          >
            Training Progress
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex h-4 overflow-hidden rounded-full">
                <div
                  className="bg-emerald-500 transition-all duration-700"
                  style={{
                    width: `${(training.completed / training.totalAssignments) * 100}%`,
                  }}
                />
                <div
                  className="bg-amber-500 transition-all duration-700"
                  style={{
                    width: `${(training.pending / training.totalAssignments) * 100}%`,
                  }}
                />
                <div className={`flex-1 ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
              </div>
            </div>
            <div className="flex gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                Completed ({training.completed})
              </span>
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                Pending ({training.pending})
              </span>
              {training.expired > 0 && (
                <span className="flex items-center gap-1">
                  <div
                    className={`h-2 w-2 rounded-full ${isDark ? "bg-zinc-600" : "bg-zinc-300"}`}
                  />
                  Expired ({training.expired})
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs for Heatmap Categories */}
      <div className="mt-4">
        <div
          className={`inline-flex rounded-2xl border p-1.5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-zinc-100"}`}
        >
          <TabBtn
            active={activeTab === "locations"}
            onClick={() => setActiveTab("locations")}
            icon={<MapPin className="h-4 w-4" />}
            label="Locations"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "departments"}
            onClick={() => setActiveTab("departments")}
            icon={<Building2 className="h-4 w-4" />}
            label="Departments"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "teams"}
            onClick={() => setActiveTab("teams")}
            icon={<Network className="h-4 w-4" />}
            label="Teams"
            isDark={isDark}
          />
          <TabBtn
            active={activeTab === "employees"}
            onClick={() => setActiveTab("employees")}
            icon={<Users className="h-4 w-4" />}
            label="Users"
            isDark={isDark}
          />
        </div>
      </div>

      {/* The Heatmap Visualizer */}
      <div
        className={`flex flex-1 flex-col overflow-hidden rounded-3xl border shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
      >
        {/* Heatmap Legend */}
        <div
          className={`flex flex-wrap items-center justify-between gap-4 border-b p-4 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
        >
          <h3
            className={`flex items-center gap-2 text-lg font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
          >
            <Layers className="h-5 w-5 opacity-50" />
            {activeTab === "locations"
              ? "Location Intensity"
              : activeTab === "departments"
                ? "Department Intensity"
                : activeTab === "teams"
                  ? "Team Intensity"
                  : "User Intensity"}
            {/* TODO: Replace with real activity scoring algorithm */}
          </h3>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>Quiet</span>
            <div className="mx-2 flex gap-1">
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-zinc-800/30" : "bg-zinc-100"}`}
              ></div>
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/10" : "bg-indigo-100"}`}
              ></div>
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/30" : "bg-indigo-200"}`}
              ></div>
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/50" : "bg-indigo-300"}`}
              ></div>
              <div
                className={`h-4 w-4 rounded-sm ${isDark ? "bg-indigo-500/80" : "bg-indigo-400"}`}
              ></div>
              <div className={`h-4 w-4 rounded-sm bg-indigo-500`}></div>
            </div>
            <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>High</span>
          </div>
        </div>

        {/* Heatmap Grid container */}
        <div className="flex-1 overflow-auto p-6">
          <div className="min-w-[800px]">
            {/* Days Header */}
            <div className="mb-2 flex">
              <div className="w-48 flex-shrink-0"></div>
              <div className="flex flex-1 justify-between px-2 text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                <span>1.</span>
                <span>5.</span>
                <span>10.</span>
                <span>15.</span>
                <span>20.</span>
                <span>25.</span>
                <span>30.</span>
              </div>
            </div>

            {/* Rows */}
            <AnimatePresence mode="popLayout" initial={false}>
              {activeData.map((row) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="group mb-2 -ml-1 flex cursor-crosshair items-center rounded-lg p-1 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <div
                    className={`w-48 flex-shrink-0 truncate pr-4 text-sm font-semibold ${isDark ? "text-zinc-300 group-hover:text-white" : "text-zinc-700 group-hover:text-black"}`}
                  >
                    {row.label}
                  </div>

                  <div className="flex h-5 flex-1 gap-1">
                    {row.data.map((val, cellIdx) => (
                      <div
                        key={cellIdx}
                        title={`${row.label} - Day ${cellIdx + 1}: Score ${val}`}
                        className={`relative flex-1 cursor-pointer rounded-[3px] transition-all duration-300 hover:z-10 hover:scale-[1.15] ${getIntensityClass(val, isDark)}`}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

interface StatCardProps {
  isDark: boolean;
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  subtitle: string;
}

function StatCard({ isDark, title, value, trend, isPositive, subtitle }: StatCardProps) {
  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm ${isDark ? "border-zinc-800 bg-[#0a0a0c]" : "border-zinc-200 bg-white"}`}
    >
      <div className="relative z-10 mb-4 flex items-start justify-between">
        <span
          className={`text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
        >
          {title}
        </span>
        {trend && (
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${isPositive ? (isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-600") : isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"}`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <div className={`text-2xl font-black ${isDark ? "text-white" : "text-zinc-900"}`}>
          {value}
        </div>
        <div className={`mt-1 text-xs ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isDark: boolean;
}

function TabBtn({ active, onClick, icon, label, isDark }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${active ? (isDark ? "border border-zinc-700 bg-zinc-800 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]" : "border border-zinc-200/50 bg-white text-zinc-900 shadow-sm") : isDark ? "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300" : "border border-transparent text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"}`}
    >
      {icon} {label}
    </button>
  );
}
