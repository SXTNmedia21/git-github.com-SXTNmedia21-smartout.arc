"use client";

/**
 * CreateChannel — Nordic Split full-screen modal redesign.
 *
 * Visual model: web-settings.jsx (920px, OKLCH warm, font-heading, backdrop-blur).
 * Preset grid: 4 cards (2×2), identical PresetCard DNA to SkrankeTab.
 * Sections:
 *   1. Velg type — preset grid (Generell / Skranke offentlig / Skranke privat / DM)
 *   2. Navngi — name + description inputs (hidden for DM)
 *   3. Tilgang — scope picker (workspace / departments / teams / people)
 *   4. Ansvarlig — combobox for Skranke types only
 *   5. Forhåndsvisning — ambient live preview card
 *
 * Backing logic:
 *   - useCreateChannel preserves all original mutation + telemetry logic
 *   - For desk_public / desk_private: chains upgradeChannelToHelpdesk after create
 *   - After create: calls setChannelAccessScope to materialise members
 *   - For dm: uses existing direct channel path
 *
 * Nordic Split: no hardcoded colors. Lucide only. CSS variables throughout.
 */

import * as React from "react";
import { useState, useMemo, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateChannel } from "../_hooks/use-create-channel";
import { upgradeChannelToHelpdesk } from "../_actions/helpdesk-channel-actions";
import { ResponsibleRepCombobox } from "./ResponsibleRepCombobox";
import { useEligibleReps } from "../_hooks/use-eligible-reps";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { toast } from "sonner";
import {
  Hash,
  LifeBuoy,
  Lock,
  MessageCircle,
  X,
  Globe,
  Building2,
  Users,
  Users2,
  UserPlus,
  Check,
  Loader2,
} from "lucide-react";
import { setChannelAccessScope } from "../_actions/access-channel-actions";

// ── Channel kind type ────────────────────────────────────────────────────────

type ChannelKind = "general" | "desk_public" | "desk_private" | "dm";

// ── Preset configuration ─────────────────────────────────────────────────────

type PresetConfig = {
  kind: ChannelKind;
  icon: React.ReactNode;
  title: string;
  lede: string;
  example: string;
  consequence: { primary: string; ai: string } | null;
};

const PRESETS: PresetConfig[] = [
  {
    kind: "general",
    icon: <Hash className="text-muted-foreground h-4 w-4" aria-hidden="true" />,
    title: "Generell kanal",
    lede: "Vanlig samtalekanal. Alle medlemmer kan skrive, lese og dele filer.",
    example: "#allmenn · #event-planning · #bakvakt",
    consequence: {
      primary: "Alle i kanalen ser meldingene.",
      ai: "AI-deltakelse: standard",
    },
  },
  {
    kind: "desk_public",
    icon: <LifeBuoy className="h-4 w-4 text-[oklch(0.65_0.18_45)]" aria-hidden="true" />,
    title: "Skranke (offentlig)",
    lede: "Fag-skranke. Spørsmål rutes til ansvarlig kollega — hele kanalen lærer av svaret.",
    example: "#it-support · #vinkunnskap · #helsekontroll",
    consequence: {
      primary: "Ansvarlig svarer. Alle ser tråden.",
      ai: "AI-deltakelse: nevnt-kun",
    },
  },
  {
    kind: "desk_private",
    icon: <Lock className="h-4 w-4 text-[oklch(0.55_0.10_240)]" aria-hidden="true" />,
    title: "Skranke (privat)",
    lede: "HR-skranke. Hver sak får sin egen private undertråd mellom ansatt og ansvarlig.",
    example: "#lønn · #hr · #personlige-saker",
    consequence: {
      primary: "Meldinger er private per spørrer.",
      ai: "AI-deltakelse: av",
    },
  },
  {
    kind: "dm",
    icon: <MessageCircle className="h-4 w-4 text-[oklch(0.55_0.12_145)]" aria-hidden="true" />,
    title: "Direktemelding",
    lede: "Én-til-én eller liten gruppe. Ingen kanalliste — kun deltakerne ser samtalen.",
    example: "Spørsmål til en kollega · uformell prat",
    consequence: null,
  },
];

// ── Access scope ─────────────────────────────────────────────────────────────

export type AccessScope =
  | { kind: "workspace" }
  | { kind: "departments"; department_ids: string[] }
  | { kind: "teams"; team_ids: string[] }
  | { kind: "invite_only" };

// Internal action scope (server action accepts "people", not "invite_only")
// invite_only = no setChannelAccessScope call (manual adds via Medlemmer tab)
type ActionScope =
  | { kind: "workspace" }
  | { kind: "departments"; department_ids: string[] }
  | { kind: "teams"; team_ids: string[] }
  | { kind: "people"; profile_ids: string[] };

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  profileId: string;
  onClose: () => void;
  onCreated: (channelId: string) => void;
};

type WorkspaceMember = {
  profile_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
};

type Department = { id: string; name: string };
type Team = { id: string; name: string };

// ── Workspace members hook ───────────────────────────────────────────────────

function useWorkspaceMembers(profileId: string) {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async (): Promise<WorkspaceMember[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profile")
        .select("profile_id, display_name, avatar_url, role")
        .eq("workspace_id", workspaceId)
        .in("status", ["active", "trainee"])
        .neq("profile_id", profileId)
        .neq("role", "system")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as WorkspaceMember[];
    },
  });
}

function useDepartments() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["departments", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<Department[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("department")
        .select("department_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      return (data ?? []).map((d) => ({ id: d.department_id, name: d.name }));
    },
  });
}

function useTeams() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["teams", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<Team[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from("team")
        .select("team_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("is_active", true)
        .order("name");
      return (data ?? []).map((t) => ({ id: t.team_id, name: t.name }));
    },
  });
}

// ── Preset card ──────────────────────────────────────────────────────────────

type PresetCardProps = {
  preset: PresetConfig;
  selected: boolean;
  onSelect: () => void;
};

function PresetCard({ preset, selected, onSelect }: PresetCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
          : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-3.5">
        {/* Radio dot */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
            selected ? "border-brand-orange" : "border-muted-foreground/50",
          )}
        >
          {selected && <span className="bg-brand-orange h-2 w-2 rounded-full" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {preset.icon}
            <div className="text-sm font-semibold tracking-[-0.005em]">{preset.title}</div>
          </div>
          <div className="text-muted-foreground text-sm leading-[1.5]">{preset.lede}</div>

          {/* Always-visible example use cases */}
          <div className="text-muted-foreground/80 mt-2 font-mono text-[11px] leading-relaxed tracking-[0.02em]">
            {preset.example}
          </div>

          {/* Active consequence strip */}
          {preset.consequence && selected && (
            <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] leading-relaxed tracking-[0.01em]">
              <div className="mb-0.5">→ {preset.consequence.primary}</div>
              <div>→ {preset.consequence.ai}</div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Tilgang section ──────────────────────────────────────────────────────────
// 4-scope preset-card model (Globe/Building2/Users2/UserPlus) — same DNA as type presets.
// Inline chip-picker for departments/teams appears BELOW the 2×2 grid when those scopes
// are active. invite_only = no inline picker; creator adds people via Medlemmer tab.

type AccessPresetCardProps = {
  icon: React.ReactNode;
  title: string;
  lede: string;
  example: string;
  consequence: string;
  selected: boolean;
  onSelect: () => void;
};

function AccessPresetCard({
  icon,
  title,
  lede,
  example,
  consequence,
  selected,
  onSelect,
}: AccessPresetCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
          : "border-border hover:border-foreground/20",
      )}
    >
      <div className="flex items-start gap-3.5">
        {/* Radio dot */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
            selected ? "border-brand-orange" : "border-muted-foreground/50",
          )}
        >
          {selected && <span className="bg-brand-orange h-2 w-2 rounded-full" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {icon}
            <div className="text-[15px] font-semibold tracking-[-0.005em]">{title}</div>
          </div>
          <div className="text-muted-foreground text-sm leading-[1.5]">{lede}</div>

          {/* Example use cases (always visible) */}
          <div className="text-muted-foreground/80 mt-2 font-mono text-[11px] leading-relaxed tracking-[0.02em]">
            {example}
          </div>

          {/* Active consequence strip */}
          {selected && (
            <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] leading-relaxed tracking-[0.01em]">
              {consequence}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

type TilgangSectionProps = {
  scope: AccessScope;
  onScopeChange: (s: AccessScope) => void;
  departments: Department[];
  teams: Team[];
  totalWorkspaceCount: number;
  workspaceName: string;
};

function TilgangSection({
  scope,
  onScopeChange,
  departments,
  teams,
  totalWorkspaceCount,
  workspaceName,
}: TilgangSectionProps) {
  const selectedDeptIds = scope.kind === "departments" ? scope.department_ids : [];
  const selectedTeamIds = scope.kind === "teams" ? scope.team_ids : [];

  const toggleDept = (id: string) => {
    const current = scope.kind === "departments" ? scope.department_ids : [];
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    onScopeChange({ kind: "departments", department_ids: next });
  };

  const toggleTeam = (id: string) => {
    const current = scope.kind === "teams" ? scope.team_ids : [];
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    onScopeChange({ kind: "teams", team_ids: next });
  };

  return (
    <SectionCard>
      <h3 className="mb-1 text-sm font-semibold">Tilgang</h3>
      <p className="text-muted-foreground mb-4 text-sm leading-[1.5]">
        Hvem ser kanalen i sidebaren
      </p>

      {/* 2×2 preset grid */}
      <fieldset aria-label="Velg tilgangsomfang" className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Tilgangsomfang</legend>

        <AccessPresetCard
          icon={<Globe className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
          title="Hele arbeidsplassen"
          lede={`Alle i ${workspaceName} ser kanalen automatisk.`}
          example="Felles kunngjøringer · nyheter · allmenn"
          consequence={`→ Synlig for alle ${totalWorkspaceCount} medlemmer`}
          selected={scope.kind === "workspace"}
          onSelect={() => onScopeChange({ kind: "workspace" })}
        />

        <AccessPresetCard
          icon={<Building2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
          title="Spesifikke avdelinger"
          lede="Velg én eller flere avdelinger."
          example="Kjøkken · servering · bar"
          consequence={`→ Synlig for ansatte i ${selectedDeptIds.length} valgte avdelinger`}
          selected={scope.kind === "departments"}
          onSelect={() => onScopeChange({ kind: "departments", department_ids: selectedDeptIds })}
        />

        <AccessPresetCard
          icon={<Users2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
          title="Spesifikke team"
          lede="Velg én eller flere team."
          example="Ledelse · vakter · opplæring"
          consequence={`→ Synlig for medlemmer i ${selectedTeamIds.length} valgte team`}
          selected={scope.kind === "teams"}
          onSelect={() => onScopeChange({ kind: "teams", team_ids: selectedTeamIds })}
        />

        <AccessPresetCard
          icon={<UserPlus className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
          title="Bare inviterte"
          lede="Manuell medlemsliste — du legger til folk én og én."
          example="HR · personlige saker · privat"
          consequence="→ Bare du ser kanalen til du legger til andre"
          selected={scope.kind === "invite_only"}
          onSelect={() => onScopeChange({ kind: "invite_only" })}
        />
      </fieldset>

      {/* Inline dept chip-picker — shown below grid when departments is active */}
      {scope.kind === "departments" && (
        <div className="border-border mt-4 border-t border-dashed pt-4">
          <div className="text-muted-foreground mb-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
            Velg avdelinger
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {departments.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => toggleDept(dept.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  selectedDeptIds.includes(dept.id)
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "hover:bg-muted",
                )}
              >
                {selectedDeptIds.includes(dept.id) ? (
                  <Check className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-3" aria-hidden="true" />
                )}
                {dept.name}
              </button>
            ))}
            {departments.length === 0 && (
              <div className="text-muted-foreground py-2 text-center font-mono text-[11px]">
                Ingen avdelinger funnet
              </div>
            )}
          </div>
          {selectedDeptIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedDeptIds.map((id) => {
                const dept = departments.find((d) => d.id === id);
                return (
                  <span
                    key={id}
                    className="bg-brand-orange/10 text-brand-orange flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px]"
                  >
                    {dept?.name ?? id}
                    <button
                      type="button"
                      onClick={() => toggleDept(id)}
                      className="hover:text-brand-orange/70"
                      aria-label={`Fjern ${dept?.name ?? id}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inline team chip-picker — shown below grid when teams is active */}
      {scope.kind === "teams" && (
        <div className="border-border mt-4 border-t border-dashed pt-4">
          <div className="text-muted-foreground mb-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
            Velg team
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {teams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => toggleTeam(team.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  selectedTeamIds.includes(team.id)
                    ? "bg-brand-orange/10 text-brand-orange"
                    : "hover:bg-muted",
                )}
              >
                {selectedTeamIds.includes(team.id) ? (
                  <Check className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <span className="w-3" aria-hidden="true" />
                )}
                {team.name}
              </button>
            ))}
            {teams.length === 0 && (
              <div className="text-muted-foreground py-2 text-center font-mono text-[11px]">
                Ingen team funnet
              </div>
            )}
          </div>
          {selectedTeamIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedTeamIds.map((id) => {
                const team = teams.find((t) => t.id === id);
                return (
                  <span
                    key={id}
                    className="bg-brand-orange/10 text-brand-orange flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px]"
                  >
                    {team?.name ?? id}
                    <button
                      type="button"
                      onClick={() => toggleTeam(id)}
                      className="hover:text-brand-orange/70"
                      aria-label={`Fjern ${team?.name ?? id}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border-border rounded-2xl border p-5", className)}>{children}</div>
  );
}

// ── Preview card ─────────────────────────────────────────────────────────────

function PreviewCard({
  kind,
  name,
  memberCount,
}: {
  kind: ChannelKind;
  name: string;
  memberCount: number;
}) {
  const preset = PRESETS.find((p) => p.kind === kind)!;
  const displayName = name.trim() || "kanalnavn";

  return (
    <div className="bg-muted/40 border-border rounded-2xl border p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="bg-muted/80 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          {kind === "dm" ? (
            <MessageCircle className="text-muted-foreground h-3.5 w-3.5" />
          ) : (
            <span className="text-muted-foreground font-mono text-[13px] font-semibold">#</span>
          )}
        </div>
        <span className="font-heading text-foreground/90 text-[20px] tracking-tight">
          {displayName}
        </span>
        {(kind === "desk_public" || kind === "desk_private") && (
          <span className="bg-success/10 ring-success/20 ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 ring-1">
            <LifeBuoy className="text-success h-3 w-3" />
            <span className="text-success font-mono text-[10px] tracking-[0.05em]">Skranke</span>
          </span>
        )}
      </div>
      <p className="text-muted-foreground font-mono text-[12px] tracking-[0.05em]">
        {memberCount > 0
          ? `${memberCount} ${memberCount === 1 ? "medlem" : "medlemmer"}`
          : "0 medlemmer"}{" "}
        · {preset.title}
      </p>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CreateChannel({ profileId, onClose, onCreated }: Props) {
  const { t } = useTranslation("komm");
  const { workspace } = useWorkspace();

  const [kind, setKind] = useState<ChannelKind>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<AccessScope>({ kind: "workspace" });
  const [responsibleId, setResponsibleId] = useState<string | null>(null);

  const createChannel = useCreateChannel(profileId);
  const [isUpgrading, startUpgrade] = useTransition();

  // Eligible reps for Skranke presets (enabled=true fetches immediately; the combobox only renders when isDeskType)
  const { data: eligibleReps = [] } = useEligibleReps(true);

  // Member count for preview + TilgangSection pickers
  const { data: members } = useWorkspaceMembers(profileId);
  const { data: departments = [] } = useDepartments();
  const { data: teams = [] } = useTeams();
  const totalMembers = members?.length ?? 0;

  const isDeskType = kind === "desk_public" || kind === "desk_private";
  const isDm = kind === "dm";

  const canCreate = useMemo(() => {
    if (createChannel.isPending || isUpgrading) return false;
    if (isDm) {
      // DM: for now treated same as general — name not required
      return true;
    }
    if (!name.trim()) return false;
    if (isDeskType && !responsibleId) return false;
    return true;
  }, [createChannel.isPending, isUpgrading, isDm, isDeskType, name, responsibleId]);

  const handleCreate = () => {
    if (!canCreate) return;

    // Map kind to channel type
    const channelType = isDm ? "direct" : "custom";

    createChannel.mutate(
      {
        channelType,
        name: !isDm && name.trim() ? name.trim() : undefined,
        memberProfileIds: undefined,
      },
      {
        onSuccess: (result) => {
          startUpgrade(async () => {
            // Materialise access scope.
            // workspace = no-op (visible workspace-wide by default).
            // invite_only = no-op (creator adds people manually via Medlemmer tab).
            // departments/teams = expand profiles via setChannelAccessScope.
            if (!isDm && scope.kind !== "workspace" && scope.kind !== "invite_only") {
              // Map AccessScope → ActionScope (action schema uses "people", not "invite_only")
              const actionScope: ActionScope = scope;
              const scopeResult = await setChannelAccessScope({
                channel_id: result.channel_id,
                scope: actionScope,
              });
              if (!scopeResult.ok) {
                toast.error(
                  "Kanalen ble opprettet, men tilgangsoppsett feilet. Prøv via innstillinger.",
                );
              }
            }

            // For desk types, chain the helpdesk upgrade
            if (isDeskType && responsibleId) {
              const backendPreset = kind === "desk_public" ? "fag" : "hr_privat";
              const upgradeResult = await upgradeChannelToHelpdesk({
                channel_id: result.channel_id,
                preset: backendPreset,
                responsible_profile_id: responsibleId,
              });
              if (!upgradeResult.ok) {
                toast.error(
                  "Kanalen ble opprettet, men skranke-oppsett feilet. Prøv via innstillinger.",
                );
              }
            }

            onCreated(result.channel_id);
          });
        },
      },
    );
  };

  const isPending = createChannel.isPending || isUpgrading;
  const nameLength = name.length;
  const descLength = description.length;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/30" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[760px] w-[min(920px,calc(100vw-48px))]",
            "-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "border-border bg-background/88 rounded-2xl border",
            "backdrop-blur-xl",
            "shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_40px_80px_-30px_rgba(0,0,0,0.45)]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out duration-200",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "noise-overlay",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Opprett kanal</DialogPrimitive.Title>
          {/* Top edge gradient */}
          <div
            aria-hidden="true"
            className="via-border h-px flex-shrink-0 bg-gradient-to-r from-transparent to-transparent"
          />

          {/* Header */}
          <div className="flex flex-shrink-0 items-start justify-between px-7 pt-5 pb-0">
            <div className="flex items-center gap-2.5">
              {/* + chip */}
              <div className="bg-muted/80 flex h-7 w-7 items-center justify-center rounded-lg">
                <span className="text-muted-foreground font-mono text-[12px] leading-none font-semibold">
                  +
                </span>
              </div>
              <h2 className="font-heading text-[28px] leading-tight tracking-tight">
                Opprett kanal
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              aria-label="Lukk"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-7 pt-5 pb-6">
            {/* Section 1 — Velg type */}
            <div>
              <h3 className="font-heading mb-1 text-[20px] tracking-tight">Velg type</h3>
              <p className="text-muted-foreground mb-4 text-sm leading-[1.5]">
                Type bestemmer hvem som kan skrive, og om kanalen fungerer som en skranke.
              </p>
              <fieldset aria-label="Velg kanaltype" className="grid grid-cols-2 gap-3">
                <legend className="sr-only">Kanaltype</legend>
                {PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.kind}
                    preset={preset}
                    selected={kind === preset.kind}
                    onSelect={() => setKind(preset.kind)}
                  />
                ))}
              </fieldset>
            </div>

            {/* Section 2 — Navngi (hidden for DM) */}
            {!isDm && (
              <SectionCard>
                <h3 className="mb-3 text-sm font-semibold">Navngi kanalen</h3>
                <div className="space-y-4">
                  {/* Name row */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="channel-name" className="text-sm font-medium">
                        Navn
                      </label>
                      <span className="text-muted-foreground font-mono text-[11px] tracking-[0.05em]">
                        {nameLength}/80
                      </span>
                    </div>
                    <div className="relative">
                      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[14px]">
                        #
                      </span>
                      <input
                        id="channel-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value.slice(0, 80))}
                        placeholder="kanal-navn"
                        autoFocus
                        className={cn(
                          "border-border bg-muted/40 focus:ring-ring w-full rounded-xl border py-2.5 pr-3 pl-8 text-sm",
                          "placeholder:text-muted-foreground/60 focus:ring-2 focus:outline-none",
                        )}
                      />
                    </div>
                  </div>

                  {/* Description row */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="channel-description" className="text-sm font-medium">
                        Beskrivelse
                        <span className="text-muted-foreground ml-1 font-normal">(valgfri)</span>
                      </label>
                      <span className="text-muted-foreground font-mono text-[11px] tracking-[0.05em]">
                        {descLength}/280
                      </span>
                    </div>
                    <textarea
                      id="channel-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 280))}
                      placeholder="Hva brukes denne kanalen til?"
                      rows={2}
                      className={cn(
                        "border-border bg-muted/40 focus:ring-ring w-full resize-none rounded-xl border px-3 py-2.5 text-sm",
                        "placeholder:text-muted-foreground/60 focus:ring-2 focus:outline-none",
                      )}
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Section 3 — Tilgang (hidden for DM) */}
            {!isDm && (
              <TilgangSection
                scope={scope}
                onScopeChange={setScope}
                departments={departments}
                teams={teams}
                totalWorkspaceCount={totalMembers + 1}
                workspaceName={workspace.name}
              />
            )}

            {/* Section 4 — Ansvarlig (Skranke types only) */}
            {isDeskType && (
              <SectionCard>
                <div className="mb-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Ansvarlig</div>
                    <div className="text-muted-foreground text-xs">
                      Den som svarer på saker i denne skranken
                    </div>
                  </div>
                  <span className="text-muted-foreground font-mono text-[10px] tracking-[0.1em] uppercase">
                    Påkrevd
                  </span>
                </div>
                <ResponsibleRepCombobox
                  reps={eligibleReps}
                  value={responsibleId}
                  onChange={setResponsibleId}
                  disabled={isPending}
                />
              </SectionCard>
            )}

            {/* Section 5 — Forhåndsvisning */}
            <div>
              <h3 className="text-muted-foreground mb-2 font-mono text-[11px] tracking-[0.02em] uppercase">
                Forhåndsvisning
              </h3>
              <PreviewCard
                kind={kind}
                name={!isDm ? name : "Direktemelding"}
                memberCount={
                  isDm
                    ? 2
                    : scope.kind === "workspace"
                      ? totalMembers + 1
                      : scope.kind === "invite_only"
                        ? 1
                        : totalMembers + 1
                }
              />
            </div>
          </div>

          {/* Sticky footer */}
          <div className="border-border/60 bg-background/60 flex shrink-0 items-center justify-between border-t px-7 py-3">
            <p className="text-muted-foreground font-mono text-[11px] tracking-[0.01em]">
              Kanalen opprettes når du trykker Opprett.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isPending}
              >
                Avbryt
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!canCreate}
                className="min-w-32"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Oppretter...
                  </>
                ) : (
                  "Opprett kanal"
                )}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
