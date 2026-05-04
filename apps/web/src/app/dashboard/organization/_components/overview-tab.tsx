import {
  Building2,
  MapPin,
  Network,
  Users,
  FileText,
  Crown,
  Globe,
  Clock,
  Banknote,
  Languages,
  Mail,
  Phone,
  ExternalLink,
  Layers,
  Shield,
  Target,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from "lucide-react";
import type { CompanyRow, WorkspaceRow, OrgTab, SetupCheckItem } from "./types";
import { LANGUAGE_LABELS, COUNTRY_LABELS, INDUSTRY_LABELS, formatOrgNumber } from "./types";

type OverviewTabProps = {
  company: CompanyRow | null;
  workspace: WorkspaceRow | null;
  stats: {
    departments: number;
    locations: number;
    teams: number;
    profiles: number;
  };
  policyCountsByScope: Record<string, number>;
  setupChecklist: SetupCheckItem[];
  deptsWithoutPositions: number;
  locsWithoutZones: number;
  isDark: boolean;
  loading: boolean;
  onTabChange: (tab: OrgTab) => void;
};

function InfoRow({
  label,
  value,
  isDark: _isDark,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  isDark: boolean;
  icon?: React.ElementType;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </span>
      <span className="text-foreground text-sm font-semibold">{value}</span>
    </div>
  );
}

function SkeletonBlock({ isDark: _isDark, className }: { isDark: boolean; className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? "h-4 w-32"}`} />;
}

export function OverviewTab({
  company,
  workspace,
  stats,
  policyCountsByScope,
  setupChecklist,
  deptsWithoutPositions,
  locsWithoutZones,
  isDark,
  loading,
  onTabChange,
}: OverviewTabProps) {
  const totalPolicies = Object.values(policyCountsByScope).reduce((a, b) => a + b, 0);
  const usagePercent =
    workspace?.max_profiles && stats.profiles
      ? Math.round((stats.profiles / workspace.max_profiles) * 100)
      : 0;

  const cardBase = "rounded-2xl border border-border bg-card p-5 transition-all";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${cardBase} animate-pulse`}>
              <SkeletonBlock isDark={isDark} className="mb-3 h-4 w-24" />
              <SkeletonBlock isDark={isDark} className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className={`${cardBase} animate-pulse`}>
            <SkeletonBlock isDark={isDark} className="mb-4 h-5 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} isDark={isDark} className="mb-3 h-4 w-full" />
            ))}
          </div>
          <div className={`${cardBase} animate-pulse`}>
            <SkeletonBlock isDark={isDark} className="mb-4 h-5 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} isDark={isDark} className="mb-3 h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Departments",
      count: stats.departments,
      icon: Building2,
      color: "orange",
      glow: "bg-orange-500/10",
      glowHover: "group-hover:bg-orange-500/20",
      iconBg: isDark
        ? "border-border bg-card text-muted-foreground"
        : "border-orange-100 bg-orange-50 text-orange-600", // Nordic Split: Phase 2.5 candidate.
      tab: "departments" as OrgTab,
    },
    {
      label: "Locations",
      count: stats.locations,
      icon: MapPin,
      color: "blue",
      glow: "bg-blue-500/10",
      glowHover: "group-hover:bg-blue-500/20",
      iconBg: isDark
        ? "border-border bg-card text-muted-foreground"
        : "border-blue-100 bg-blue-50 text-blue-600", // Nordic Split: Phase 2.5 candidate.
      tab: "locations" as OrgTab,
    },
    {
      label: "Teams",
      count: stats.teams,
      icon: Network,
      color: "violet",
      glow: "bg-violet-500/10",
      glowHover: "group-hover:bg-violet-500/20",
      iconBg: isDark
        ? "border-border bg-card text-muted-foreground"
        : "border-violet-100 bg-violet-50 text-violet-600", // Nordic Split: Phase 2.5 candidate.
      tab: "teams" as OrgTab,
    },
    {
      label: "Staff",
      count: stats.profiles,
      icon: Users,
      color: "emerald",
      glow: "bg-emerald-500/10",
      glowHover: "group-hover:bg-emerald-500/20",
      iconBg: isDark
        ? "border-border bg-card text-muted-foreground"
        : "border-emerald-100 bg-emerald-50 text-emerald-600", // Nordic Split: Phase 2.5 candidate.
    },
  ];

  const doneCount = setupChecklist.filter((c) => c.done).length;
  const allDone = doneCount === setupChecklist.length;
  const progressPercent =
    setupChecklist.length > 0 ? Math.round((doneCount / setupChecklist.length) * 100) : 0;
  const progressColor =
    progressPercent > 75
      ? "bg-emerald-500"
      : progressPercent >= 50
        ? "bg-amber-500"
        : "bg-orange-500";

  const hasWarnings = deptsWithoutPositions > 0 || locsWithoutZones > 0;

  return (
    <div className="space-y-6">
      {/* Setup Completeness Card */}
      {!allDone && (
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-3">
            <div className="border-border bg-muted rounded-lg border p-2">
              <Target className={`h-4 w-4 ${isDark ? "text-orange-500" : "text-orange-600"}`} />
            </div>
            <div className="flex-1">
              <h3 className="text-foreground text-sm font-bold">Getting Started</h3>
              <p className="text-muted-foreground text-xs">
                Complete these steps to set up your workspace
              </p>
            </div>
            <span className="border-border bg-muted text-muted-foreground rounded-full border px-2.5 py-0.5 text-xs font-bold">
              {doneCount}/{setupChecklist.length}
            </span>
          </div>

          {/* Progress bar */}
          <div className="bg-muted mb-4 h-1.5 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Checklist items */}
          <div className="space-y-2">
            {setupChecklist.map((item) => (
              <div
                key={item.key}
                onClick={!item.done && item.tab ? () => onTabChange(item.tab!) : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  !item.done && item.tab ? "cursor-pointer" : ""
                } ${!item.done && item.tab ? "hover:bg-accent" : ""}`}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    item.done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {item.label}
                </span>
                {!item.done && item.tab && (
                  <span className="text-muted-foreground ml-auto text-xs">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              onClick={card.tab ? () => onTabChange(card.tab!) : undefined}
              className={`group relative overflow-hidden ${cardBase} ${card.tab ? "cursor-pointer" : ""}`}
            >
              <div
                className={`absolute -top-4 -right-4 h-24 w-24 rounded-full ${card.glow} blur-2xl transition-colors ${card.glowHover}`}
              />
              <div className="relative z-10 mb-3 flex items-center gap-3">
                <div className={`rounded-lg border p-2 ${card.iconBg}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  {card.label}
                </h3>
              </div>
              <div className="relative z-10 flex items-end gap-2">
                <span className="text-foreground text-3xl leading-none font-bold">
                  {card.count}
                </span>
                {card.tab && (
                  <span className="text-muted-foreground mb-0.5 text-xs font-medium">
                    manage &rarr;
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Warnings Banner */}
      {hasWarnings && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            isDark ? "border-amber-500/10 bg-amber-500/5" : "border-amber-100 bg-amber-50"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 h-4 w-4 shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`}
          />
          <div className="space-y-1">
            {deptsWithoutPositions > 0 && (
              <p className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
                {deptsWithoutPositions} {deptsWithoutPositions === 1 ? "department" : "departments"}{" "}
                without positions
              </p>
            )}
            {locsWithoutZones > 0 && (
              <p className={`text-xs ${isDark ? "text-amber-300/80" : "text-amber-700"}`}>
                {locsWithoutZones} {locsWithoutZones === 1 ? "location" : "locations"} without zones
              </p>
            )}
          </div>
        </div>
      )}

      {/* Company + Workspace Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Identity */}
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-3">
            <div className="border-border bg-muted rounded-lg border p-2">
              <Crown className={`h-4 w-4 ${isDark ? "text-orange-500" : "text-orange-600"}`} />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">Company</h3>
              <p className="text-muted-foreground text-xs">Legal entity</p>
            </div>
          </div>

          {company ? (
            <div className="divide-border space-y-0 divide-y">
              <div className="pb-3">
                <h4 className="text-foreground text-lg font-bold">{company.name}</h4>
                {company.legal_name && company.legal_name !== company.name && (
                  <p className="text-muted-foreground text-xs">{company.legal_name}</p>
                )}
              </div>

              <div className="pt-2">
                <InfoRow
                  label="Org.nr"
                  value={formatOrgNumber(company.org_number)}
                  isDark={isDark}
                  icon={FileText}
                />
                <InfoRow
                  label="Industry"
                  value={INDUSTRY_LABELS[company.industry] ?? company.industry}
                  isDark={isDark}
                  icon={Building2}
                />
                <InfoRow
                  label="Country"
                  value={COUNTRY_LABELS[company.country] ?? company.country}
                  isDark={isDark}
                  icon={Globe}
                />
                <InfoRow
                  label="Daglig leder"
                  value={company.daglig_leder}
                  isDark={isDark}
                  icon={Crown}
                />
                {company.nace_description && (
                  <InfoRow
                    label="NACE"
                    value={`${company.nace_code ?? ""} ${company.nace_description}`}
                    isDark={isDark}
                    icon={Layers}
                  />
                )}
              </div>

              {(company.phone || company.email || company.website) && (
                <div className="pt-2">
                  <InfoRow label="Phone" value={company.phone} isDark={isDark} icon={Phone} />
                  <InfoRow label="Email" value={company.email} isDark={isDark} icon={Mail} />
                  <InfoRow
                    label="Website"
                    value={company.website}
                    isDark={isDark}
                    icon={ExternalLink}
                  />
                </div>
              )}

              {(company.address_line_1 || company.city) && (
                <div className="pt-2">
                  <InfoRow
                    label="Address"
                    value={[company.address_line_1, company.address_line_2]
                      .filter(Boolean)
                      .join(", ")}
                    isDark={isDark}
                    icon={MapPin}
                  />
                  <InfoRow
                    label="City"
                    value={[company.postal_code, company.city].filter(Boolean).join(" ") || null}
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Company data not available</p>
          )}
        </div>

        {/* Workspace Details */}
        <div className={cardBase}>
          <div className="mb-4 flex items-center gap-3">
            <div className="border-border bg-muted rounded-lg border p-2">
              <Building2 className={`h-4 w-4 ${isDark ? "text-blue-500" : "text-blue-600"}`} />
            </div>
            <div>
              <h3 className="text-foreground text-sm font-bold">Workspace</h3>
              <p className="text-muted-foreground text-xs">Operational unit</p>
            </div>
          </div>

          {workspace ? (
            <div className="divide-border space-y-0 divide-y">
              <div className="pb-3">
                <h4 className="text-foreground text-lg font-bold">{workspace.name}</h4>
                <p className="text-muted-foreground text-xs">{workspace.slug}.smartout.ai</p>
              </div>

              <div className="pt-2">
                <InfoRow label="Timezone" value={workspace.timezone} isDark={isDark} icon={Clock} />
                <InfoRow
                  label="Language"
                  value={LANGUAGE_LABELS[workspace.language] ?? workspace.language}
                  isDark={isDark}
                  icon={Languages}
                />
                <InfoRow
                  label="Currency"
                  value={workspace.currency}
                  isDark={isDark}
                  icon={Banknote}
                />
                <InfoRow
                  label="Country"
                  value={COUNTRY_LABELS[workspace.country] ?? workspace.country}
                  isDark={isDark}
                  icon={Globe}
                />
              </div>

              {workspace.active_modules && workspace.active_modules.length > 0 && (
                <div className="pt-3">
                  <span className="text-muted-foreground text-xs font-medium">Active modules</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {workspace.active_modules.map((mod) => (
                      <span
                        key={mod}
                        className="border-border bg-muted text-muted-foreground rounded-md border px-2 py-0.5 text-[10px] font-bold"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {workspace.brand_color && (
                <div className="flex items-center gap-2 pt-3">
                  <span className="text-muted-foreground text-xs font-medium">Brand color</span>
                  <div
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: workspace.brand_color }}
                  />
                  <span className="text-muted-foreground font-mono text-xs">
                    {workspace.brand_color}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Workspace data not available</p>
          )}
        </div>
      </div>

      {/* Subscription Strip */}
      {company && (
        <div className="border-border bg-card rounded-2xl border p-5">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Plan
              </span>
              <p className="text-foreground text-sm font-bold capitalize">
                {company.subscription_plan ?? "No plan"}
              </p>
            </div>

            <div className="bg-border h-8 w-px" />

            <div>
              <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                Status
              </span>
              <div className="flex items-center gap-2">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    company.subscription_status === "active"
                      ? "bg-emerald-500"
                      : company.subscription_status === "trial"
                        ? "animate-pulse bg-amber-500"
                        : "bg-muted-foreground"
                  }`}
                />
                <p className="text-foreground text-sm font-bold capitalize">
                  {company.subscription_status ?? "Unknown"}
                </p>
              </div>
            </div>

            {company.trial_ends_at && (
              <>
                <div className="bg-border h-8 w-px" />
                <div>
                  <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Trial ends
                  </span>
                  <p
                    className={`text-sm font-bold ${isDark ? "text-amber-400" : "text-amber-600"}`}
                  >
                    {new Date(company.trial_ends_at).toLocaleDateString("nb-NO")}
                  </p>
                </div>
              </>
            )}

            <div className="bg-border h-8 w-px" />

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                  Profiles
                </span>
                <span className="text-muted-foreground text-xs font-semibold">
                  {stats.profiles}
                  {workspace?.max_profiles ? ` / ${workspace.max_profiles}` : ""}
                </span>
              </div>
              {workspace?.max_profiles && (
                <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={`h-full rounded-full transition-all ${
                      usagePercent > 80
                        ? "bg-rose-500"
                        : usagePercent > 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Governance Summary */}
      <div className="border-border bg-card rounded-2xl border p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="border-border bg-muted rounded-lg border p-2">
            <Shield className={`h-4 w-4 ${isDark ? "text-emerald-500" : "text-emerald-600"}`} />
          </div>
          <div>
            <h3 className="text-foreground text-sm font-bold">Governance Connections</h3>
            <p className="text-muted-foreground text-xs">
              Policies scoped to organizational entities
            </p>
          </div>
          <span className="border-border bg-muted text-muted-foreground ml-auto rounded-full border px-2.5 py-0.5 text-xs font-bold">
            {totalPolicies} total
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { scope: "workspace", label: "Workspace", icon: Building2 },
              { scope: "department", label: "Department", icon: Building2 },
              { scope: "location", label: "Location", icon: MapPin },
              { scope: "team", label: "Team", icon: Network },
            ] as const
          ).map((item) => {
            const count = policyCountsByScope[item.scope] ?? 0;
            const Icon = item.icon;
            return (
              <div key={item.scope} className="border-border bg-muted rounded-xl border p-3">
                <div className="flex items-center gap-2">
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
                    {item.label}
                  </span>
                </div>
                <p className="text-foreground mt-1 text-xl font-bold">
                  {count}
                  <span className="text-muted-foreground ml-1 text-xs font-medium">
                    {count === 1 ? "policy" : "policies"}
                  </span>
                </p>
              </div>
            );
          })}
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          Each workspace, department, location, and team can have policies, protocols, procedures,
          routines, and control lists attached. Manage them in Governance.
        </p>
      </div>
    </div>
  );
}
