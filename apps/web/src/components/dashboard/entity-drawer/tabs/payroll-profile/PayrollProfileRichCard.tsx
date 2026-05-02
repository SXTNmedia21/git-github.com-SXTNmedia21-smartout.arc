"use client";

/**
 * PayrollProfileRichCard — rich 3-tab drawer card for an employee payroll profile.
 * Entity ID = employee_payroll_profile.id (the PK uuid, NOT profile_id).
 * Tabs: Oversikt / Tariff / Historikk
 * KPI tiles: Timelønn (from tariff) / Ukentlige timer / Ansiennitet (years)
 */

import { Wallet, CheckCircle2, AlertTriangle, Activity, Clock } from "lucide-react";
import { useState } from "react";
import { useDrawerPayrollProfile } from "@/app/dashboard/_hooks/use-drawer-payroll-profile";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";
import { DrawerSection } from "../../shared/DrawerSection";

type Tab = "oversikt" | "tariff" | "historikk";

export function PayrollProfileRichCard({ entityId }: { entityId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const { data, isLoading } = useDrawerPayrollProfile(entityId);

  if (isLoading) return <DrawerSkeleton />;
  if (!data?.payroll) return <DrawerEmptyState icon={Wallet} message="Lønnskort ikke funnet" />;

  const payroll = data.payroll;

  const tabs: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "tariff", label: "Tariff" },
    { key: "historikk", label: "Historikk" },
  ];

  // Derived display values — tariff_rate_table uses `amount` + `unit`, not hourly_rate
  const hourlyRateDisplay = data.tariffRate?.amount
    ? `${data.tariffRate.amount.toFixed(2)} ${data.tariffRate.unit}`
    : "—";
  const weeklyHoursDisplay = payroll.agreed_weekly_hours
    ? `${Number(payroll.agreed_weekly_hours)}t`
    : "—";
  const seniorityDisplay = data.seniorityYears !== null ? `${data.seniorityYears} år` : "—";

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="border-border/50 from-muted to-card relative border-b bg-gradient-to-br px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold shadow-lg">
            {data.profileName?.charAt(0).toUpperCase() ?? "L"}
          </div>
          <div>
            <h2 className="font-heading text-foreground text-xl leading-tight font-bold">
              {data.profileName ?? "Lønnskort"}
            </h2>
            <p className="text-muted-foreground text-xs font-semibold capitalize">
              {data.profileRole ?? "—"}
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Timelønn
            </span>
            <span className="text-foreground font-mono text-sm font-bold">{hourlyRateDisplay}</span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Uketimer
            </span>
            <span className="text-foreground font-mono text-lg font-bold">
              {weeklyHoursDisplay}
            </span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Ansiennitet
            </span>
            <span className="text-foreground font-mono text-sm font-bold">{seniorityDisplay}</span>
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
            <DrawerSection label="Lønnsmodell">
              <div className="border-border bg-card space-y-2.5 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground font-semibold capitalize">
                    {payroll.salary_type === "hourly" ? "Timelønn" : "Månedslønn"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tarifkategori</span>
                  <span className="text-foreground font-mono text-xs">
                    {payroll.tariff_category}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fagbrev</span>
                  <span
                    className={`flex items-center gap-1.5 text-xs font-semibold ${payroll.has_fagbrev ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
                  >
                    {payroll.has_fagbrev ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Ja
                      </>
                    ) : (
                      "Nei"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Feriepenger</span>
                  <span className="text-foreground font-mono text-xs">
                    {Number(payroll.holiday_allowance_pct)}%
                  </span>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection label="Ansiennitetsstart">
              <span className="text-foreground font-mono text-sm">
                {new Date(payroll.seniority_start_date).toLocaleDateString("nb-NO", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </DrawerSection>

            {payroll.trade_union_member && (
              <DrawerSection label="Fagforening">
                <span className="bg-muted text-foreground rounded-lg px-2.5 py-1 text-xs font-medium">
                  Medlem
                </span>
              </DrawerSection>
            )}
          </div>
        )}

        {activeTab === "tariff" && (
          <div className="space-y-5">
            {data.tariffRate ? (
              <DrawerSection label="Tariffoverstyr (aktiv)">
                <div className="border-border bg-card space-y-2.5 rounded-xl border p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sats</span>
                    <span className="text-foreground font-mono font-bold">
                      {data.tariffRate.amount.toFixed(2)} {data.tariffRate.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground font-mono text-xs capitalize">
                      {data.tariffRate.rate_type}
                    </span>
                  </div>
                  {data.tariffRate.seniority_years !== null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ansiennitetsår</span>
                      <span className="text-foreground font-mono text-xs">
                        {data.tariffRate.seniority_years}
                      </span>
                    </div>
                  )}
                </div>
              </DrawerSection>
            ) : (
              <div className="border-warning/20 bg-warning/10 flex items-center gap-2 rounded-xl border p-4 text-sm">
                <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
                <span className="text-warning">
                  Ingen tariffoverstyr registrert. Sats beregnes via rammeverk.
                </span>
              </div>
            )}

            <DrawerSection label="Lønnsprofil">
              <div className="border-border bg-card space-y-2.5 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gyldig fra</span>
                  <span className="text-foreground font-mono text-xs">
                    {new Date(payroll.valid_from).toLocaleDateString("nb-NO")}
                  </span>
                </div>
                {payroll.valid_until && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gyldig til</span>
                    <span className="text-foreground font-mono text-xs">
                      {new Date(payroll.valid_until).toLocaleDateString("nb-NO")}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Synkstatus</span>
                  <span
                    className={`font-mono text-[10px] tracking-wider uppercase ${payroll.payroll_sync_status === "synced" ? "text-[color:var(--entity-accent)]" : "text-muted-foreground"}`}
                  >
                    {payroll.payroll_sync_status}
                  </span>
                </div>
              </div>
            </DrawerSection>
          </div>
        )}

        {activeTab === "historikk" && (
          <div className="space-y-5">
            <DrawerSection label="Lønnskort">
              <div className="border-border bg-card space-y-2.5 rounded-xl border p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ID</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {payroll.id.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gyldig fra</span>
                  <span className="text-foreground font-mono text-xs">
                    {new Date(payroll.valid_from).toLocaleDateString("nb-NO")}
                  </span>
                </div>
                {payroll.tariff_override_id && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tariffoverstyr</span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {payroll.tariff_override_id.slice(0, 8)}…
                    </span>
                  </div>
                )}
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
