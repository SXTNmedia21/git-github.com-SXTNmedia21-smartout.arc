"use client";

/**
 * DepartmentRichCard — rich 3-tab drawer card for a department entity.
 * Tabs: Oversikt (overview) / Drift (operations) / Historikk (history)
 * KPI tiles: Ansatte / Aktive vakter (today) / Avvik (last 7d)
 * Replaces the minimal DepartmentDetailTab.
 */

import {
  Loader2,
  Building2,
  Users,
  AlertTriangle,
  CalendarClock,
  Clock,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { useDrawerDepartment } from "@/app/dashboard/_hooks/use-drawer-department";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";
import { DrawerSection } from "../../shared/DrawerSection";

const DAY_NAMES = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];

type Tab = "oversikt" | "drift" | "historikk";

export function DepartmentRichCard({ entityId }: { entityId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const { data, isLoading } = useDrawerDepartment(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.department)
    return <DrawerEmptyState icon={Building2} message="Avdeling ikke funnet" />;

  const dept = data.department;
  const deviationCount = data.recentDeviations.length;

  const tabs: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "drift", label: "Drift" },
    { key: "historikk", label: "Historikk" },
  ];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Hero */}
      <div className="border-border/50 from-muted to-card relative border-b bg-gradient-to-br px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
            style={{ backgroundColor: dept.color ?? "oklch(0.65 0.18 55)" }}
          >
            {dept.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-heading text-foreground text-xl leading-tight font-bold">
              {dept.name}
            </h2>
            <p
              className={`text-xs font-semibold ${dept.is_active ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
            >
              {dept.is_active ? "Aktiv" : "Inaktiv"}
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Ansatte
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {data.employeeCount}
            </span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              I dag
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {data.todaySession?.actual_shifts ?? 0}
            </span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Avvik 7d
            </span>
            <span
              className={`font-mono text-lg font-bold ${deviationCount > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {deviationCount}
            </span>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="border-border no-scrollbar overflow-x-auto border-b px-5">
        <div className="flex min-w-max gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative pt-3 pb-3 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <div
                  className="absolute bottom-0 left-0 h-0.5 w-full rounded-t-full"
                  style={{ backgroundColor: "var(--entity-accent)" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === "oversikt" && (
          <div className="space-y-5">
            {dept.description && (
              <DrawerSection label="Beskrivelse">
                <p className="text-foreground text-sm leading-relaxed">{dept.description}</p>
              </DrawerSection>
            )}

            {data.managerName && (
              <DrawerSection label="Avdelingsleder">
                <div className="flex items-center gap-2.5">
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {data.managerName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="text-foreground text-sm font-medium">{data.managerName}</span>
                </div>
              </DrawerSection>
            )}

            {data.operatingHours.length > 0 && (
              <DrawerSection label="Åpningstider">
                <div className="space-y-1.5">
                  {data.operatingHours.map((h) => (
                    <div key={h.day_of_week} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-8 font-medium">
                        {DAY_NAMES[h.day_of_week] ?? "—"}
                      </span>
                      {h.is_closed ? (
                        <span className="text-muted-foreground text-xs">Stengt</span>
                      ) : (
                        <span className="text-foreground font-mono text-xs">
                          {h.open_time?.slice(0, 5)} – {h.close_time?.slice(0, 5)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </DrawerSection>
            )}

            <DrawerSection label="Opprettet">
              <span className="text-muted-foreground font-mono text-xs">
                {new Date(dept.created_at).toLocaleDateString("nb-NO")}
              </span>
            </DrawerSection>
          </div>
        )}

        {activeTab === "drift" && (
          <div className="space-y-5">
            {/* Today's session */}
            <DrawerSection label="Dagens økt">
              {data.todaySession ? (
                <div className="border-border bg-card space-y-2 rounded-xl border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-semibold ${
                        data.todaySession.status === "active"
                          ? "bg-success/10 text-[color:var(--entity-accent)]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${data.todaySession.status === "active" ? "bg-[color:var(--entity-accent)]" : "bg-muted-foreground"}`}
                      />
                      {data.todaySession.status === "active"
                        ? "Åpen"
                        : data.todaySession.status === "upcoming"
                          ? "Planlagt"
                          : data.todaySession.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Vakter</span>
                    <span className="text-foreground font-mono font-bold">
                      {data.todaySession.actual_shifts ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Oppgaver</span>
                    <span className="text-foreground font-mono text-sm">
                      {data.todaySession.tasks_completed ?? 0}/{data.todaySession.tasks_total ?? 0}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                  <CalendarClock className="h-4 w-4 shrink-0" />
                  <span>Ingen økt planlagt i dag</span>
                </div>
              )}
            </DrawerSection>

            {/* Recent deviations */}
            <DrawerSection label="Avvik siste 7 dager">
              {data.recentDeviations.length === 0 ? (
                <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-[color:var(--entity-accent)]" />
                  <span>Ingen avvik registrert</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recentDeviations.map((d) => (
                    <div
                      key={d.deviation_id}
                      className="border-border bg-card flex items-start justify-between rounded-xl border p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            d.severity === "critical"
                              ? "text-destructive"
                              : d.severity === "high"
                                ? "text-warning"
                                : "text-muted-foreground"
                          }`}
                        />
                        <div>
                          <p className="text-foreground text-xs font-semibold">{d.title}</p>
                          <p className="text-muted-foreground mt-0.5 font-mono text-[10px] tracking-wider uppercase">
                            {d.severity} · {d.status}
                          </p>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {new Date(d.created_at).toLocaleDateString("nb-NO")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
          </div>
        )}

        {activeTab === "historikk" && (
          <div className="space-y-5">
            <DrawerSection label="Avdeling">
              <div className="border-border bg-card space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Opprettet</span>
                  <span className="text-foreground font-mono text-xs">
                    {new Date(dept.created_at).toLocaleDateString("nb-NO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {dept.department_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`text-xs font-semibold ${dept.is_active ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
                  >
                    {dept.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
              </div>
            </DrawerSection>

            <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-sm">
              <Activity className="h-6 w-6 opacity-40" />
              <span>Endringslogg kommer</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
