"use client";

/**
 * GenereltTab — General channel settings (name, description, visibility, danger zone).
 *
 * Visual pattern: Section cards (rounded-2xl bg-card border) matching SkrankeTab + web-settings.jsx.
 *
 * Cards:
 *   1. Identitet  — inline-editable name (font-heading, # prefix), description textarea
 *                   with mono char counter, ambient mono stats row (type · created · members)
 *   2. Tilgang    — 2-col preset grid: Åpen (Globe) / Privat (Lock)
 *                   Active card: brand-orange border + ring-[3px] + dashed-top consequence strip
 *                   TODO: is_private column missing from schema — writes deferred until migration adds it
 *   3. Faresone   — separated dashed-border card (mt-8), inline-expand actions:
 *                   Archive (inline button) + Delete (owner-only, double-confirm with channel-name input)
 *
 * Nordic Split tokens only. Lucide icons only. No hardcoded colors.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  Archive,
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Lock,
  Loader2,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useWorkspace } from "@/lib/workspace-context";
import {
  renameChannel,
  setChannelDescription,
  archiveChannel,
  deleteChannel,
} from "../_actions/general-channel-actions";

// ── Access scope model (replaces binary Åpen/Privat) ───────────────────────
// TODO: persist to `channel.access_scope` once migration 20260519200000 is applied.
// Until then, state is local only. Console logs the intended scope on save.

type AccessScope =
  | { kind: "workspace" }
  | { kind: "departments"; department_ids: string[] }
  | { kind: "teams"; team_ids: string[] }
  | { kind: "invite_only" };

type DepartmentEntry = { id: string; name: string };
type TeamEntry = { id: string; name: string };

function useDepartmentsData() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["departments", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<DepartmentEntry[]> => {
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

function useTeamsData() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["teams", workspace.workspace_id],
    staleTime: 60_000,
    queryFn: async (): Promise<TeamEntry[]> => {
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

type GenereltTabProps = {
  channelId: string;
  channelName: string;
  onSettled?: () => void;
  onCancel?: () => void;
};

function useChannelGeneralData(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-general", workspace.workspace_id, channelId],
    staleTime: 15_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("channel")
        .select(
          "id, name, description, channel_type, created_at, created_by, is_archived, is_read_only",
        )
        .eq("id", channelId)
        .maybeSingle();
      return data;
    },
  });
}

function useChannelMemberCount(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-member-count", workspace.workspace_id, channelId],
    staleTime: 30_000,
    queryFn: async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("channel_member")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", channelId)
        .is("left_at", null);
      return count ?? 0;
    },
  });
}

// ── AccessScopeCard — preset card for the 4-scope Tilgang picker ─────────────

type AccessScopeCardProps = {
  icon: React.ReactNode;
  title: string;
  lede: string;
  consequence: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

function AccessScopeCard({
  icon,
  title,
  lede,
  consequence,
  selected,
  disabled,
  onSelect,
}: AccessScopeCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
          : "border-border hover:border-foreground/20",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <div className="flex items-start gap-3.5">
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
          <div className="text-muted-foreground text-[13px] leading-[1.5]">{lede}</div>
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

export function GenereltTab({ channelId, channelName, onSettled, onCancel }: GenereltTabProps) {
  const { t } = useTranslation("helpdesk");
  const { workspace } = useWorkspace();
  const { data: isAdmin } = useWorkspaceAdmin();
  const { data: channelData } = useChannelGeneralData(channelId);
  const { data: memberCount } = useChannelMemberCount(channelId);

  const { data: departments = [] } = useDepartmentsData();
  const { data: teams = [] } = useTeamsData();

  const [name, setName] = React.useState(channelName);
  const [description, setDescription] = React.useState("");
  // TODO(migration): persist access_scope to `channel.access_scope` column once
  // migration supabase/migrations/20260519200000_channel_access_scope.sql is applied.
  // Until then, state is local only. On save, the intended scope is console-logged.
  const [accessScope, setAccessScope] = React.useState<AccessScope>({ kind: "workspace" });
  const [selectedDeptIds, setSelectedDeptIds] = React.useState<string[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = React.useState<string[]>([]);
  const [isPending, startTransition] = React.useTransition();

  // Danger zone expand state
  const [showArchiveConfirm, setShowArchiveConfirm] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = React.useState("");

  // Sync channel data when it loads
  React.useEffect(() => {
    if (channelData) {
      setName(channelData.name ?? channelName);
      setDescription(channelData.description ?? "");
    }
  }, [channelData, channelName]);

  const descriptionLength = description.length;
  const descriptionOverLimit = descriptionLength > 280;

  const isDirty =
    name.trim() !== (channelData?.name ?? channelName) ||
    description !== (channelData?.description ?? "");

  const handleSave = () => {
    if (!isDirty) return;
    startTransition(async () => {
      const nameChanged = name.trim() !== (channelData?.name ?? channelName);
      const descChanged = description !== (channelData?.description ?? "");

      const tasks: Array<Promise<{ ok: boolean; error?: string }>> = [];
      if (nameChanged && name.trim()) {
        tasks.push(renameChannel({ channel_id: channelId, new_name: name.trim() }));
      }
      if (descChanged) {
        tasks.push(setChannelDescription({ channel_id: channelId, description }));
      }

      const results = await Promise.all(tasks);
      const failure = results.find((r) => !r.ok);
      if (failure && !failure.ok) {
        toast.error((failure as { ok: false; error: string }).error);
        return;
      }
      // TODO(migration): write accessScope to channel.access_scope once migration is applied
      // eslint-disable-next-line no-console
      console.log("[GenereltTab] intended access_scope (not persisted yet):", accessScope);
      toast.success(t("channel_settings.general_saved"));
      onSettled?.();
    });
  };

  const handleArchive = () => {
    startTransition(async () => {
      const result = await archiveChannel({ channel_id: channelId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.general_archived"));
      onSettled?.();
      onCancel?.();
    });
  };

  const handleDelete = () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteChannel({
        channel_id: channelId,
        confirm_name: deleteConfirmName,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.general_deleted"));
      onCancel?.();
    });
  };

  const createdDate = channelData?.created_at
    ? new Date(channelData.created_at).toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[20px] tracking-tight">
            {t("channel_settings.general_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.general_lede")}
          </p>
        </div>

        {/* Card 1 — Identitet */}
        <div className="bg-card border-border mb-4 rounded-2xl border p-5">
          {/* Sub-section label */}
          <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
            {t("channel_settings.general_identity_heading")}
          </div>

          {/* Channel name — large inline feel with # prefix */}
          <div className="mb-4">
            <div className="relative">
              <span
                aria-hidden="true"
                className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm font-semibold select-none"
              >
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                disabled={!isAdmin || isPending}
                className={cn(
                  "border-border bg-background focus:ring-ring font-heading w-full rounded-xl border py-2.5 pr-3 pl-8 text-[15px] font-semibold tracking-tight transition-colors focus:ring-2 focus:outline-none",
                  !isAdmin && "cursor-not-allowed opacity-60",
                )}
                placeholder={t("channel_settings.general_name_placeholder")}
              />
            </div>
          </div>

          {/* Description with char counter */}
          <div className="mb-4">
            <div className="mb-1.5 flex items-end justify-between">
              <label className="block text-sm font-semibold">
                {t("channel_settings.general_description_label")}
              </label>
              <span
                className={cn(
                  "font-mono text-[11px] transition-colors",
                  descriptionOverLimit ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {descriptionLength}/280
              </span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              rows={3}
              disabled={!isAdmin || isPending}
              className={cn(
                "border-border bg-background focus:ring-ring w-full resize-none rounded-xl border px-3 py-2.5 text-sm transition-colors focus:ring-2 focus:outline-none",
                !isAdmin && "cursor-not-allowed opacity-60",
                descriptionOverLimit && "border-destructive",
              )}
              placeholder={t("channel_settings.general_description_placeholder")}
            />
          </div>

          {/* Ambient mono stats row — type · created · members */}
          {(channelData?.channel_type || createdDate || memberCount !== undefined) && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-0 font-mono text-[11px]">
              {channelData?.channel_type && (
                <>
                  <span className="bg-muted rounded px-1.5 py-0.5">{channelData.channel_type}</span>
                  {(createdDate || memberCount !== undefined) && (
                    <span className="mx-2 opacity-30">·</span>
                  )}
                </>
              )}
              {createdDate && (
                <>
                  <span>
                    {t("channel_settings.general_created")} {createdDate}
                  </span>
                  {memberCount !== undefined && <span className="mx-2 opacity-30">·</span>}
                </>
              )}
              {memberCount !== undefined && (
                <span>
                  {memberCount} {t("channel_settings.general_members")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card 2 — Tilgang (4-scope preset model replaces binary Åpen/Privat) */}
        {/* TODO(migration): reads/writes deferred until supabase/migrations/20260519200000_channel_access_scope.sql is applied */}
        <div className="bg-card border-border mb-4 rounded-2xl border p-5">
          <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
            Tilgang
          </div>
          <p className="text-muted-foreground mb-4 text-sm">Hvem ser kanalen i sidebaren</p>

          <fieldset
            aria-label="Velg tilgangsomfang"
            className="grid grid-cols-2 gap-3"
            disabled={!isAdmin}
          >
            <legend className="sr-only">Tilgangsomfang</legend>

            {/* Scope 1 — Hele arbeidsplassen */}
            <AccessScopeCard
              icon={<Globe className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
              title="Hele arbeidsplassen"
              lede={`Alle i ${workspace.name} ser kanalen automatisk.`}
              consequence={`→ Synlig for alle ${memberCount ?? 0} medlemmer`}
              selected={accessScope.kind === "workspace"}
              disabled={!isAdmin}
              onSelect={() => {
                setAccessScope({ kind: "workspace" });
                setSelectedDeptIds([]);
                setSelectedTeamIds([]);
              }}
            />

            {/* Scope 2 — Spesifikke avdelinger */}
            <AccessScopeCard
              icon={<Building2 className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
              title="Spesifikke avdelinger"
              lede="Velg én eller flere avdelinger."
              consequence={`→ Synlig for ansatte i ${selectedDeptIds.length} valgte avdelinger`}
              selected={accessScope.kind === "departments"}
              disabled={!isAdmin}
              onSelect={() => {
                setAccessScope({ kind: "departments", department_ids: selectedDeptIds });
              }}
            />

            {/* Scope 3 — Spesifikke team */}
            <AccessScopeCard
              icon={<Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
              title="Spesifikke team"
              lede="Velg én eller flere team."
              consequence={`→ Synlig for medlemmer i ${selectedTeamIds.length} valgte team`}
              selected={accessScope.kind === "teams"}
              disabled={!isAdmin}
              onSelect={() => {
                setAccessScope({ kind: "teams", team_ids: selectedTeamIds });
              }}
            />

            {/* Scope 4 — Bare inviterte */}
            <AccessScopeCard
              icon={<UserPlus className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
              title="Bare inviterte"
              lede="Manuell medlemsliste — du legger til folk én og én."
              consequence="→ Bare du ser kanalen til du legger til andre"
              selected={accessScope.kind === "invite_only"}
              disabled={!isAdmin}
              onSelect={() => {
                setAccessScope({ kind: "invite_only" });
                setSelectedDeptIds([]);
                setSelectedTeamIds([]);
              }}
            />
          </fieldset>

          {/* Inline chip-picker for departments (shown below preset row when active) */}
          {accessScope.kind === "departments" && isAdmin && (
            <div className="border-border mt-4 border-t border-dashed pt-4">
              <div className="text-muted-foreground mb-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
                Velg avdelinger
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => {
                      const next = selectedDeptIds.includes(dept.id)
                        ? selectedDeptIds.filter((id) => id !== dept.id)
                        : [...selectedDeptIds, dept.id];
                      setSelectedDeptIds(next);
                      setAccessScope({ kind: "departments", department_ids: next });
                    }}
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
                          onClick={() => {
                            const next = selectedDeptIds.filter((d) => d !== id);
                            setSelectedDeptIds(next);
                            setAccessScope({ kind: "departments", department_ids: next });
                          }}
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

          {/* Inline chip-picker for teams (shown below preset row when active) */}
          {accessScope.kind === "teams" && isAdmin && (
            <div className="border-border mt-4 border-t border-dashed pt-4">
              <div className="text-muted-foreground mb-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
                Velg team
              </div>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => {
                      const next = selectedTeamIds.includes(team.id)
                        ? selectedTeamIds.filter((id) => id !== team.id)
                        : [...selectedTeamIds, team.id];
                      setSelectedTeamIds(next);
                      setAccessScope({ kind: "teams", team_ids: next });
                    }}
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
                          onClick={() => {
                            const next = selectedTeamIds.filter((t) => t !== id);
                            setSelectedTeamIds(next);
                            setAccessScope({ kind: "teams", team_ids: next });
                          }}
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
        </div>

        {/* Card 3 — Faresone (admin only, dashed top border, mt-8) */}
        {isAdmin && (
          <div className="border-border mt-8 rounded-2xl border border-dashed">
            {/* Danger zone header */}
            <div className="border-border border-b border-dashed px-5 py-3">
              <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                {t("channel_settings.general_danger_zone")}
              </div>
            </div>

            {/* Archive — inline expand */}
            <div className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Archive className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                    {t("channel_settings.general_archive_label")}
                  </div>
                  <div className="text-muted-foreground mt-1 font-mono text-[11px] leading-relaxed">
                    → {t("channel_settings.general_archive_consequence")}
                  </div>
                </div>
                {!showArchiveConfirm ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowArchiveConfirm(true)}
                    disabled={isPending || !!channelData?.is_archived}
                    className="shrink-0 gap-2"
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("channel_settings.general_archive_action")}
                  </Button>
                ) : (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowArchiveConfirm(false)}
                      disabled={isPending}
                    >
                      {t("skranke_tab.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleArchive}
                      disabled={isPending}
                      className="gap-2"
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t("channel_settings.general_archive_action")}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Delete — destructive, dashed separator, owner-only confirm */}
            <div className="border-border border-t border-dashed px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-destructive flex items-center gap-2 text-sm font-semibold">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    {t("channel_settings.general_delete_label")}
                  </div>
                  <div className="text-destructive/70 mt-1 font-mono text-[11px] leading-relaxed">
                    → {t("channel_settings.general_delete_consequence")}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={
                    isPending ||
                    (showDeleteConfirm && deleteConfirmName !== (channelData?.name ?? channelName))
                  }
                  className="shrink-0 gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {showDeleteConfirm
                    ? t("channel_settings.general_delete_confirm_action")
                    : t("channel_settings.general_delete_action")}
                </Button>
              </div>

              {/* Double-confirm input (shown after first click) */}
              {showDeleteConfirm && (
                <div className="bg-destructive/5 border-destructive/20 mt-3 rounded-xl border p-3">
                  <label className="text-muted-foreground mb-2 block text-xs font-medium">
                    {t("channel_settings.general_delete_confirm_label", {
                      name: channelData?.name ?? channelName,
                    })}
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    disabled={isPending}
                    className="border-destructive bg-background focus:ring-destructive/30 w-full rounded-xl border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                    placeholder={channelData?.name ?? channelName}
                    autoFocus
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="border-border bg-background/60 flex items-center justify-between border-t px-8 py-4">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {t("skranke_tab.autosave_hint")}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t("skranke_tab.cancel")}
          </Button>
          {isAdmin && (
            <Button
              type="button"
              variant="default"
              onClick={handleSave}
              disabled={isPending || !isDirty || descriptionOverLimit}
              className="min-w-32"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  {t("skranke_tab.save_pending")}
                </>
              ) : (
                t("skranke_tab.save_full")
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
