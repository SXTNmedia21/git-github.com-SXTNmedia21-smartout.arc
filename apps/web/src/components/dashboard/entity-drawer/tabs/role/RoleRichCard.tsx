"use client";

/**
 * RoleRichCard — concept-card drawer for a profile_role enum value.
 * Entity ID = role slug (e.g. "manager"). No DB entity row.
 * Tabs: Oversikt / Tilgang / Personer
 * KPI tiles: Antall / Kanaler / Ansvarsomfang
 */

import { Shield, Users, Lock, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useDrawerRole, type ProfileRole } from "@/app/dashboard/_hooks/use-drawer-role";
import { DrawerSkeleton } from "../../shared/DrawerSkeleton";
import { DrawerEmptyState } from "../../shared/DrawerEmptyState";
import { DrawerSection } from "../../shared/DrawerSection";

type Tab = "oversikt" | "tilgang" | "personer";

/* Role metadata — static, authoritative descriptions */
type RoleMeta = {
  label: string;
  description: string;
  channels: string;
  scope: string;
  permissions: string[];
};

const ROLE_META: Record<ProfileRole, RoleMeta> = {
  owner: {
    label: "Eier",
    description:
      "Fullt systemansvar. Kan endre alle innstillinger, fakturering og workspace-konfigurasjon.",
    channels: "Alle",
    scope: "Hele workspace",
    permissions: [
      "All adminrettigheter",
      "Fakturering og abonnement",
      "Workspace-oppsett",
      "Brukeradministrasjon",
      "Kontrakter og signaturer",
      "Dataeksport og sletterett",
    ],
  },
  admin: {
    label: "Administrator",
    description: "Kan administrere ansatte, avdelinger, opplæring og driftsinnstillinger.",
    channels: "Alle operasjonelle",
    scope: "Hele workspace",
    permissions: [
      "Opprett og rediger ansatte",
      "Avdelingsadministrasjon",
      "Protokoll- og policy-styring",
      "Vaktplanlegging",
      "Avviksbehandling",
      "Rapporter og analytics",
    ],
  },
  manager: {
    label: "Leder",
    description: "Team- og avdelingsleder med ansvar for drift og daglig oppfølging.",
    channels: "Team og avdeling",
    scope: "Eget team / avdeling",
    permissions: [
      "Se teamets ansatte",
      "Godkjenne vaktbytte",
      "Registrere avvik",
      "Sesjonskontroll",
      "Protokolloppfølging",
      "Lese HR-data (begrenset)",
    ],
  },
  employee: {
    label: "Ansatt",
    description: "Standard bruker. Ser egne vakter, protokoller og kommunikasjonskanaler.",
    channels: "Tildelte kanaler",
    scope: "Eget profil",
    permissions: [
      "Se egne vakter",
      "Fullføre protokoller",
      "Melde avvik",
      "Team-kommunikasjon",
      "Be om vaktbytte",
    ],
  },
  system: {
    label: "System",
    description: "Intern systemprofil for automatiserte prosesser. Ikke en menneskelig bruker.",
    channels: "Interne",
    scope: "Systemnivå",
    permissions: ["Automatiserte oppgaver", "Engine-triggere", "Systemnotifikasjoner"],
  },
};

const statusDot: Record<string, string> = {
  active: "bg-[color:var(--entity-accent)]",
  trainee: "bg-warning",
  inactive: "bg-muted-foreground",
  offboarding: "bg-destructive",
};

export function RoleRichCard({ entityId }: { entityId: string }) {
  const role = entityId as ProfileRole;
  const [activeTab, setActiveTab] = useState<Tab>("oversikt");
  const { data, isLoading } = useDrawerRole(role);

  const meta = ROLE_META[role];

  if (isLoading) return <DrawerSkeleton />;
  if (!meta) return <DrawerEmptyState icon={Shield} message="Ukjent rolle" />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "oversikt", label: "Oversikt" },
    { key: "tilgang", label: "Tilgang" },
    { key: "personer", label: "Personer" },
  ];

  const count = data?.count ?? 0;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="border-border/50 from-muted to-card relative border-b bg-gradient-to-br px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg"
            style={{ backgroundColor: "var(--entity-accent)" }}
          >
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-foreground text-xl leading-tight font-bold">
              {meta.label}
            </h2>
            <p className="text-muted-foreground text-xs font-semibold capitalize">{role}</p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Antall
            </span>
            <span className="text-foreground font-mono text-lg font-bold">{count}</span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Kanaler
            </span>
            <span className="text-foreground w-full truncate px-1 text-xs font-bold">
              {meta.channels}
            </span>
          </div>
          <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border p-3 text-center">
            <span className="text-muted-foreground mb-1 text-[9px] font-bold tracking-widest uppercase">
              Omfang
            </span>
            <span className="text-foreground w-full truncate px-1 text-xs font-bold">
              {meta.scope.split(" ")[0]}
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
            <DrawerSection label="Beskrivelse">
              <p className="text-foreground text-sm leading-relaxed">{meta.description}</p>
            </DrawerSection>

            <DrawerSection label="Ansvarsomfang">
              <div className="border-border bg-card rounded-xl border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-foreground">{meta.scope}</span>
                </div>
              </div>
            </DrawerSection>

            <DrawerSection label={`Antall med rollen`}>
              <div className="border-border bg-card flex items-center gap-3 rounded-xl border p-4">
                <Users className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-foreground font-mono text-lg font-bold">{count}</span>
                <span className="text-muted-foreground text-sm">aktive profiler</span>
              </div>
            </DrawerSection>
          </div>
        )}

        {activeTab === "tilgang" && (
          <div className="space-y-5">
            <DrawerSection label="Tillatelser">
              <div className="space-y-2">
                {meta.permissions.map((perm) => (
                  <div
                    key={perm}
                    className="border-border bg-card flex items-center gap-3 rounded-xl border p-3"
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor:
                          "color-mix(in oklch, var(--entity-accent) 15%, transparent)",
                        color: "var(--entity-accent)",
                      }}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </div>
                    <span className="text-foreground text-sm">{perm}</span>
                  </div>
                ))}
              </div>
            </DrawerSection>

            <div className="border-border/50 bg-muted/30 rounded-xl border p-4">
              <p className="text-muted-foreground text-xs leading-relaxed">
                Fullstendig tilgangsstyring administreres via C4 Authority Config. Disse listene er
                en veiledende oversikt.
              </p>
            </div>
          </div>
        )}

        {activeTab === "personer" && (
          <div className="space-y-3">
            {isLoading ? (
              <DrawerSkeleton />
            ) : !data || data.profiles.length === 0 ? (
              <DrawerEmptyState
                icon={Users}
                message={`Ingen aktive ${meta.label.toLowerCase()}e`}
              />
            ) : (
              data.profiles.map((p) => (
                <div
                  key={p.profile_id}
                  className="border-border bg-card flex items-center gap-3 rounded-xl border p-3.5"
                >
                  <div className="bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {p.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-semibold">
                      {p.display_name}
                    </p>
                    {p.department_name && (
                      <p className="text-muted-foreground truncate text-[10px]">
                        {p.department_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${statusDot[p.status] ?? "bg-muted-foreground"}`}
                  />
                </div>
              ))
            )}
            {data && data.count > 20 && (
              <p className="text-muted-foreground py-2 text-center text-xs">
                Viser 20 av {data.count} — søk for å finne spesifikke profiler
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
