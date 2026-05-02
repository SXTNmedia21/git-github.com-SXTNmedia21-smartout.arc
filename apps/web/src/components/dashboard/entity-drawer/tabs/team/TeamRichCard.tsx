"use client";

/**
 * TeamRichCard — rich 3-tab drawer card for a team entity.
 * Tabs: Oversikt / Aktivitet / Historikk
 * KPI tiles: Medlemmer / Aktive vakter (next 7d) / Sesong
 */

import { Users, Activity, CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useDrawerTeam } from "@/app/dashboard/_hooks/use-drawer-team";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";
import { DrawerSection } from "../../shared/DrawerSection";

type Tab = "oversikt" | "aktivitet" | "historikk";

const statusDot: Record<string, string> = {
  active: "bg-[color:var(--entity-accent)]",
  trainee: "bg-warning",
  inactive: "bg-muted-foreground",
  offboarding: "bg-destructive",
};

export function TeamRichCard({ entityId }: { entityId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const { data, isLoading } = useDrawerTeam(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.team) return <DrawerEmptyState icon={Users} message="Team ikke funnet" />;

  const team = data.team;

  const tabs: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "aktivitet", label: "Aktivitet" },
    { key: "historikk", label: "Historikk" },
  ];

  return (
    <div className="flex min-h-0 flex-col">
      {/* Hero */}
      <div className="border-border/50 from-muted to-card relative border-b bg-gradient-to-br px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold text-white shadow-lg"
            style={{ backgroundColor: team.color ?? "oklch(0.60 0.12 280)" }}
          >
            {team.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-heading text-foreground text-xl leading-tight font-bold">
              {team.name}
            </h2>
            <p className="text-muted-foreground text-xs font-semibold capitalize">
              {team.team_type === "operational" ? "Driftsteam" : team.team_type}
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Medlemmer
            </span>
            <span className="text-foreground font-mono text-lg font-bold">{data.memberCount}</span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Vakter 7d
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {data.upcomingShiftCount}
            </span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Sesong
            </span>
            <span className="text-foreground w-full truncate px-1 text-xs font-bold">
              {data.seasonName}
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
            {team.description && (
              <DrawerSection label="Beskrivelse">
                <p className="text-foreground text-sm leading-relaxed">{team.description}</p>
              </DrawerSection>
            )}

            {data.leaderName && (
              <DrawerSection label="Teamleder">
                <div className="flex items-center gap-2.5">
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {data.leaderName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <span className="text-foreground text-sm font-medium">{data.leaderName}</span>
                </div>
              </DrawerSection>
            )}

            {data.departmentName && (
              <DrawerSection label="Avdeling">
                <span className="text-foreground text-sm">{data.departmentName}</span>
              </DrawerSection>
            )}

            {/* Members grid */}
            <DrawerSection label={`Medlemmer (${data.memberCount})`}>
              {data.members.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ingen medlemmer registrert</p>
              ) : (
                <div className="space-y-2">
                  {data.members.map((m) => (
                    <div
                      key={m.profile_id}
                      className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
                    >
                      <div className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold">
                        {m.display_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-sm font-semibold">
                          {m.display_name}
                        </p>
                        <p className="text-muted-foreground text-[10px] capitalize">{m.role}</p>
                      </div>
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${statusDot[m.status] ?? "bg-muted-foreground"}`}
                      />
                    </div>
                  ))}
                </div>
              )}
            </DrawerSection>
          </div>
        )}

        {activeTab === "aktivitet" && (
          <div className="space-y-5">
            <DrawerSection label="Kommende vakter (7 dager)">
              <div className="border-border bg-card flex items-center justify-between rounded-xl border p-4">
                <div className="flex items-center gap-2.5">
                  <CalendarClock className="text-muted-foreground h-4 w-4" />
                  <span className="text-foreground text-sm">Vakter neste 7 dager</span>
                </div>
                <span className="text-foreground font-mono text-lg font-bold">
                  {data.upcomingShiftCount}
                </span>
              </div>
            </DrawerSection>

            <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-sm">
              <CheckCircle2 className="h-6 w-6 opacity-40" />
              <span>Detaljert aktivitetslogg kommer</span>
            </div>
          </div>
        )}

        {activeTab === "historikk" && (
          <div className="space-y-5">
            <DrawerSection label="Team">
              <div className="border-border bg-card space-y-3 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Opprettet</span>
                  <span className="text-foreground font-mono text-xs">
                    {new Date(team.created_at).toLocaleDateString("nb-NO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {team.team_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground text-xs capitalize">{team.team_type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={`text-xs font-semibold ${team.is_active ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
                  >
                    {team.is_active ? "Aktiv" : "Inaktiv"}
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
