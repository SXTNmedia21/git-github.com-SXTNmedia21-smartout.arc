"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Building2,
  Receipt,
  CheckSquare,
  FileWarning,
  Search,
  ThumbsUp,
} from "lucide-react";
import { motion } from "framer-motion";

// MOCK DATA based on PRD-03
type SessionStatus = "OPEN" | "NEEDS_INPUT" | "READY_FOR_ADMIN" | "APPROVED" | "LOCKED";

interface DailySession {
  id: string;
  department: string;
  date: string;
  status: SessionStatus;
  totalShifts: number;
  hoursCalculated: number;
  revenue: number | null;
  revenueExpected: number;
  deviations: number;
  tasksCompleted: number;
  tasksTotal: number;
}

const MOCK_SESSIONS: DailySession[] = [
  {
    id: "S-101",
    department: "Bårdshaug Vegkro",
    date: "2026-02-26",
    status: "READY_FOR_ADMIN",
    totalShifts: 8,
    hoursCalculated: 62.5,
    revenue: 45200,
    revenueExpected: 42000,
    deviations: 2,
    tasksCompleted: 14,
    tasksTotal: 14,
  },
  {
    id: "S-102",
    department: "Trondheim City",
    date: "2026-02-26",
    status: "NEEDS_INPUT",
    totalShifts: 5,
    hoursCalculated: 38,
    revenue: null,
    revenueExpected: 55000,
    deviations: 1,
    tasksCompleted: 10,
    tasksTotal: 12,
  },
  {
    id: "S-103",
    department: "Bårdshaug Vegkro",
    date: "2026-02-25",
    status: "APPROVED",
    totalShifts: 7,
    hoursCalculated: 56,
    revenue: 39500,
    revenueExpected: 40000,
    deviations: 0,
    tasksCompleted: 14,
    tasksTotal: 14,
  },
  {
    id: "S-104",
    department: "Oslo S (Kiosk)",
    date: "2026-02-26",
    status: "OPEN",
    totalShifts: 3,
    hoursCalculated: 24,
    revenue: null,
    revenueExpected: 22000,
    deviations: 0,
    tasksCompleted: 6,
    tasksTotal: 10,
  },
];

const MOCK_SHIFTS = [
  {
    id: "SH-1",
    name: "Anna Olsen",
    role: "Skiftleder",
    scheduled: "08:00 - 16:00",
    actual: "07:54 - 16:15",
    hours: 8.25,
    breaks: "30 min",
    status: "ok",
  },
  {
    id: "SH-2",
    name: "Ola Nordmann",
    role: "Servitør",
    scheduled: "10:00 - 18:00",
    actual: "10:15 - 18:00",
    hours: 7.75,
    breaks: "30 min",
    status: "late_checkin",
  },
  {
    id: "SH-3",
    name: "Kari Svendsen",
    role: "Kokk",
    scheduled: "14:00 - 22:00",
    actual: "13:50 - 23:15",
    hours: 9.41,
    breaks: "0 min",
    status: "overtime_no_break",
  },
];

export function ReconciliationView({ isDark }: { isDark: boolean }) {
  const [selectedSession, setSelectedSession] = useState<DailySession | null>(null);
  const [activeTab, setActiveTab] = useState<"vakter" | "omsetning" | "avvik" | "oppgaver">(
    "vakter",
  );

  const getStatusStyles = (status: SessionStatus) => {
    switch (status) {
      case "APPROVED":
        return isDark
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-emerald-50 text-emerald-600 border-emerald-200";
      case "READY_FOR_ADMIN":
        return isDark
          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
          : "bg-blue-50 text-blue-600 border-blue-200";
      case "NEEDS_INPUT":
        return isDark
          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
          : "bg-orange-50 text-orange-600 border-orange-200";
      case "OPEN":
        return isDark
          ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
          : "bg-zinc-100 text-zinc-600 border-zinc-200";
      default:
        return isDark
          ? "bg-zinc-800 text-zinc-400 border-zinc-700"
          : "bg-zinc-100 text-zinc-500 border-zinc-200";
    }
  };

  const getStatusLabel = (status: SessionStatus) => {
    switch (status) {
      case "APPROVED":
        return "Godkjent";
      case "READY_FOR_ADMIN":
        return "Klar for godkjenning";
      case "NEEDS_INPUT":
        return "Mangler input (Ansatt)";
      case "OPEN":
        return "Pågår";
      default:
        return status;
    }
  };

  return (
    <div className="animate-in fade-in custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-y-auto pr-2 pb-6 duration-500">
      {!selectedSession ? (
        // LIST VIEW
        <>
          <div className="flex flex-shrink-0 flex-col justify-between gap-4 pt-2 md:flex-row md:items-center">
            <div>
              <h1
                className={`text-2xl font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
              >
                Daglig Avstemming
              </h1>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                Admin dashboard for sign-off på timer, omsetning og avvik (PRD-03).
              </p>
            </div>
            <div className="flex gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"}`}
              >
                <Search className={`h-4 w-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
                <input
                  type="text"
                  placeholder="Søk avdeling/dato..."
                  className={`w-32 bg-transparent text-sm focus:outline-none md:w-48 ${isDark ? "text-zinc-200 placeholder:text-zinc-600" : "text-zinc-800 placeholder:text-zinc-400"}`}
                />
              </div>
            </div>
          </div>

          <div
            className={`overflow-hidden rounded-2xl border shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            <div
              className={`grid grid-cols-12 gap-4 border-b px-6 py-4 text-xs font-bold tracking-wider uppercase ${isDark ? "border-zinc-800 bg-zinc-900/50 text-zinc-500" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}
            >
              <div className="col-span-3">Dato / Avdeling</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Timer</div>
              <div className="col-span-2">Avvik / Oppgaver</div>
              <div className="col-span-2">Omsetning</div>
              <div className="col-span-1 text-right">Handling</div>
            </div>
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {MOCK_SESSIONS.map((session) => (
                <div
                  key={session.id}
                  className={`group grid cursor-pointer grid-cols-12 items-center gap-4 px-6 py-5 transition-colors ${isDark ? "hover:bg-zinc-900/50" : "hover:bg-zinc-50"}`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="col-span-3 flex flex-col gap-1">
                    <div
                      className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}
                    >
                      {session.date}
                    </div>
                    <div
                      className={`flex items-center gap-1.5 text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {session.department}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${getStatusStyles(session.status)}`}
                    >
                      {getStatusLabel(session.status)}
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <div
                      className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                    >
                      {session.hoursCalculated} t
                    </div>
                    <div className={`text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {session.totalShifts} vakter
                    </div>
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      {session.deviations > 0 ? (
                        <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-bold text-red-500">
                          <AlertTriangle className="h-3 w-3" /> {session.deviations}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-bold text-emerald-500">
                          <CheckCircle2 className="h-3 w-3" /> 0
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] ${session.tasksCompleted < session.tasksTotal ? "font-medium text-orange-500" : isDark ? "text-zinc-500" : "text-zinc-400"}`}
                    >
                      Oppgaver: {session.tasksCompleted}/{session.tasksTotal}
                    </div>
                  </div>
                  <div className="col-span-2">
                    {session.revenue ? (
                      <div
                        className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                      >
                        kr {session.revenue.toLocaleString("no")}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs font-medium text-orange-500">
                        <AlertTriangle className="h-3.5 w-3.5" /> Mangler Input
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      className={`rounded-lg p-2 transition-colors ${isDark ? "text-zinc-400 group-hover:bg-zinc-800 group-hover:text-white" : "text-zinc-400 group-hover:bg-zinc-200 group-hover:text-zinc-900"}`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        // DETAIL VIEW (Avstemmingsvindu)
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex h-full flex-col gap-6"
        >
          {/* Header */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setSelectedSession(null)}
                className={`mt-1 rounded-xl border p-2 transition-colors ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white" : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1
                    className={`text-2xl font-black tracking-tight ${isDark ? "text-zinc-100" : "text-zinc-900"}`}
                  >
                    {selectedSession.department}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-bold tracking-widest uppercase ${getStatusStyles(selectedSession.status)}`}
                  >
                    {getStatusLabel(selectedSession.status)}
                  </span>
                </div>
                <div
                  className={`flex items-center gap-4 text-sm font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> {selectedSession.date}
                  </span>
                  <span>Session ID: {selectedSession.id}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${isDark ? "border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"}`}
              >
                Se komplett logg
              </button>
              <button className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-600">
                <ThumbsUp className="h-4 w-4" /> Godkjenn Dag
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div
            className={`flex flex-1 flex-col overflow-hidden rounded-3xl border shadow-sm ${isDark ? "border-zinc-800 bg-[#0c0c0e]" : "border-zinc-200 bg-white"}`}
          >
            {/* Tabs */}
            <div
              className={`flex items-center border-b p-2 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
            >
              <TabBtn
                active={activeTab === "vakter"}
                onClick={() => setActiveTab("vakter")}
                icon={<Clock className="h-4 w-4" />}
                label="Vakter & Timer"
                isDark={isDark}
              />
              <TabBtn
                active={activeTab === "omsetning"}
                onClick={() => setActiveTab("omsetning")}
                icon={<Receipt className="h-4 w-4" />}
                label="Omsetning"
                isDark={isDark}
              />
              <TabBtn
                active={activeTab === "avvik"}
                onClick={() => setActiveTab("avvik")}
                icon={<FileWarning className="h-4 w-4" />}
                label="Avvik & Hendelser"
                isDark={isDark}
                badge={selectedSession.deviations}
              />
              <TabBtn
                active={activeTab === "oppgaver"}
                onClick={() => setActiveTab("oppgaver")}
                icon={<CheckSquare className="h-4 w-4" />}
                label="Oppgaver"
                isDark={isDark}
              />
            </div>

            {/* Tab Content */}
            <div className="overflow-y-auto p-6">
              {activeTab === "vakter" && (
                <div className="space-y-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3
                      className={`text-lg font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                    >
                      Skiftavstemming
                    </h3>
                    <div className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      Beregnet total:{" "}
                      <strong className={isDark ? "text-white" : "text-zinc-900"}>
                        {selectedSession.hoursCalculated} timer
                      </strong>
                    </div>
                  </div>

                  <div
                    className={`overflow-hidden rounded-xl border ${isDark ? "border-zinc-800 bg-zinc-900/30" : "border-zinc-200 bg-zinc-50"}`}
                  >
                    <table className="w-full text-left text-sm">
                      <thead
                        className={`text-xs font-bold tracking-wider uppercase ${isDark ? "bg-zinc-900/50 text-zinc-500" : "bg-zinc-100 text-zinc-500"}`}
                      >
                        <tr>
                          <th className="px-4 py-3">Ansatt</th>
                          <th className="px-4 py-3">Planlagt</th>
                          <th className="px-4 py-3">Faktisk Punch</th>
                          <th className="border-r px-4 py-3 dark:border-zinc-800">Pause</th>
                          <th className="border-x bg-orange-500/5 px-4 py-3 dark:border-zinc-800">
                            Beregnet
                          </th>
                          <th className="px-4 py-3 text-right">Handling</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {MOCK_SHIFTS.map((shift) => (
                          <tr
                            key={shift.id}
                            className={`${isDark ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"} ${shift.status !== "ok" ? (isDark ? "bg-red-500/5" : "bg-red-50") : ""}`}
                          >
                            <td className="px-4 py-4">
                              <div
                                className={`font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}
                              >
                                {shift.name}
                              </div>
                              <div
                                className={`text-[11px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                              >
                                {shift.role}
                              </div>
                            </td>
                            <td
                              className={`px-4 py-4 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}
                            >
                              {shift.scheduled}
                            </td>
                            <td className="px-4 py-4">
                              <div
                                className={`font-medium ${isDark ? "text-zinc-300" : "text-zinc-800"}`}
                              >
                                {shift.actual}
                              </div>
                              {shift.status === "late_checkin" && (
                                <span className="mt-0.5 block text-[10px] font-bold whitespace-nowrap text-red-500">
                                  Sent: 15 min
                                </span>
                              )}
                              {shift.status === "overtime_no_break" && (
                                <span className="mt-0.5 block text-[10px] font-bold whitespace-nowrap text-red-500">
                                  Overtid + Ingen pause
                                </span>
                              )}
                            </td>
                            <td
                              className={`border-r px-4 py-4 dark:border-zinc-800 ${shift.breaks === "0 min" ? "font-bold text-red-500" : isDark ? "text-zinc-400" : "text-zinc-600"}`}
                            >
                              {shift.breaks}
                            </td>
                            <td className="border-x bg-orange-500/5 px-4 py-4 dark:border-zinc-800">
                              <div className="font-bold text-orange-500">{shift.hours} t</div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              {shift.status === "ok" ? (
                                <span className="flex items-center justify-end gap-1 text-xs font-bold text-emerald-500">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> OK
                                </span>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-zinc-700">
                                    Behandle
                                  </button>
                                  <button className="rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-bold text-indigo-500 transition-colors hover:bg-indigo-500/10">
                                    AI Handoff
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === "omsetning" && (
                <div className="max-w-xl">
                  <h3
                    className={`mb-4 text-lg font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                  >
                    Dagsomsetning
                  </h3>
                  <div
                    className={`rounded-2xl border p-6 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
                  >
                    <div className="space-y-4">
                      <div>
                        <label
                          className={`mb-2 block text-xs font-bold tracking-wider uppercase ${isDark ? "text-zinc-500" : "text-zinc-500"}`}
                        >
                          Registrert Omsetning (NOK)
                        </label>
                        <div className="relative">
                          <span className="absolute top-1/2 left-4 -translate-y-1/2 font-bold text-zinc-500">
                            kr
                          </span>
                          <input
                            type="number"
                            defaultValue={selectedSession.revenue || ""}
                            placeholder="Skriv inn beløp..."
                            className={`w-full rounded-xl border py-3 pr-4 pl-10 text-lg transition-colors focus:ring-2 focus:ring-orange-500/50 focus:outline-none ${isDark ? "border-zinc-700 bg-[#0c0c0e] text-white" : "border-zinc-300 bg-white text-zinc-900"}`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-600 dark:text-orange-400">
                        <div className="font-semibold">Forventet via historikk / budsjett:</div>
                        <div className="font-black">
                          kr {selectedSession.revenueExpected.toLocaleString("no")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "avvik" && (
                <div>
                  <h3
                    className={`mb-4 flex items-center gap-2 text-lg font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                  >
                    Håndter Avvik{" "}
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">
                      {selectedSession.deviations} ubehandlet
                    </span>
                  </h3>
                  <p className={`mb-6 text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    Gå gjennom loggførte avvik og hendelser før dagen kan godkjennes.
                  </p>

                  {/* Mock deviation items */}
                  <div className="space-y-3">
                    <div
                      className={`flex flex-col justify-between gap-4 rounded-xl border p-4 md:flex-row md:items-center ${isDark ? "border-red-500/20 bg-red-500/5" : "border-red-200 bg-red-50"}`}
                    >
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold tracking-widest text-red-500 uppercase">
                            System-Avvik
                          </span>
                          <span
                            className={`text-sm font-bold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}
                          >
                            Kari Svendsen mangler pause
                          </span>
                        </div>
                        <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                          Vakt fra 13:50 til 23:15 loggført med 0 minutter pause (Policy krever min.
                          30 min).
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-bold transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                          Trekk lovpålagt pause (30m)
                        </button>
                        <button className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-600">
                          Start AI Dialog
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "oppgaver" && (
                <div>
                  <h3
                    className={`mb-4 text-lg font-bold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}
                  >
                    Dagsoppgaver & Sjekklister
                  </h3>
                  <p className={`${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    Integrasjon mot Operations Hub for å se hva som ble gjort denne dagen.
                  </p>
                  <div className="mt-8 rounded-2xl border-2 border-dashed border-zinc-200 p-12 text-center dark:border-zinc-800">
                    <CheckSquare
                      className={`mx-auto mb-3 h-8 w-8 opacity-20 ${isDark ? "text-white" : "text-black"}`}
                    />
                    <p className={`font-semibold ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                      {selectedSession.tasksCompleted} av {selectedSession.tasksTotal} oppgaver
                      fullført. Viser detaljert sjekkliste-gjennomføring her.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

interface TabBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  isDark: boolean;
  badge?: number;
}

function TabBtn({ active, onClick, icon, label, isDark, badge }: TabBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${active ? (isDark ? "bg-zinc-800 text-white" : "border border-zinc-200/50 bg-white text-zinc-900 shadow-sm") : isDark ? "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300" : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700"}`}
    >
      {icon} {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
