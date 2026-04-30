"use client";

/**
 * LocationRichCard — rich 3-tab drawer card for a location entity.
 * Tabs: Oversikt / Avdelinger / Historikk
 * KPI tiles: Avdelinger / Ansatte / Aktive vakter (today)
 */

import { MapPin, Building2, Activity, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useDrawerLocation } from "@/app/dashboard/_hooks/use-drawer-location";
import { useEntityDrawerOptional } from "../../EntityDrawerContext";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";
import { DrawerSection } from "../../shared/DrawerSection";

type Tab = "oversikt" | "avdelinger" | "historikk";

export function LocationRichCard({ entityId }: { entityId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const { data, isLoading } = useDrawerLocation(entityId);
  const drawer = useEntityDrawerOptional();

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.location) return <DrawerEmptyState icon={MapPin} message="Lokasjon ikke funnet" />;

  const location = data.location;

  const tabs: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "avdelinger", label: "Avdelinger" },
    { key: "historikk", label: "Historikk" },
  ];

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="border-border/50 from-muted to-card relative border-b bg-gradient-to-br px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold shadow-lg">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-foreground text-xl leading-tight font-bold">
              {location.name}
            </h2>
            <p
              className={`text-xs font-semibold ${location.is_active ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
            >
              {location.is_active ? "Aktiv" : "Inaktiv"} ·{" "}
              <span className="capitalize">{location.location_type}</span>
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Avdelinger
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {data.departmentCount}
            </span>
          </div>
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
              Vakter nå
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {data.activeShiftsToday}
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
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "oversikt" && (
          <div className="space-y-5">
            {location.description && (
              <DrawerSection label="Beskrivelse">
                <p className="text-foreground text-sm leading-relaxed">{location.description}</p>
              </DrawerSection>
            )}

            {location.address && (
              <DrawerSection label="Adresse">
                <span className="text-foreground text-sm">{location.address}</span>
              </DrawerSection>
            )}

            {(location.latitude !== null || location.longitude !== null) && (
              <DrawerSection label="Koordinater">
                <span className="text-foreground font-mono text-xs">
                  {location.latitude?.toFixed(6)}, {location.longitude?.toFixed(6)}
                </span>
              </DrawerSection>
            )}

            {location.capacity !== null && (
              <DrawerSection label="Kapasitet">
                <span className="text-foreground font-mono text-sm">{location.capacity}</span>
              </DrawerSection>
            )}

            <DrawerSection label="Opprettet">
              <span className="text-muted-foreground font-mono text-xs">
                {new Date(location.created_at).toLocaleDateString("nb-NO")}
              </span>
            </DrawerSection>
          </div>
        )}

        {activeTab === "avdelinger" && (
          <div className="space-y-3">
            {data.departments.length === 0 ? (
              <DrawerEmptyState icon={Building2} message="Ingen avdelinger på denne lokasjonen" />
            ) : (
              data.departments.map((dept) => (
                <button
                  key={dept.department_id}
                  onClick={() => drawer?.openDrawer("department", dept.department_id)}
                  className="border-border bg-card hover:bg-muted/50 group flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-colors"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: dept.color ?? "oklch(0.65 0.18 55)" }}
                  >
                    {dept.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-semibold">{dept.name}</p>
                    <p
                      className={`text-[10px] font-medium ${dept.is_active ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
                    >
                      {dept.is_active ? "Aktiv" : "Inaktiv"}
                    </p>
                  </div>
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
                </button>
              ))
            )}
          </div>
        )}

        {activeTab === "historikk" && (
          <div className="space-y-5">
            <DrawerSection label="Lokasjon">
              <div className="border-border bg-card space-y-2.5 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Opprettet</span>
                  <span className="text-foreground font-mono text-xs">
                    {new Date(location.created_at).toLocaleDateString("nb-NO", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {location.location_id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground text-xs capitalize">
                    {location.location_type}
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
