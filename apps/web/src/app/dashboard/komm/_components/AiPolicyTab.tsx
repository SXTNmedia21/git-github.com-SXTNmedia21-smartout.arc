"use client";

/**
 * AiPolicyTab — Botsson AI access configuration for a channel.
 *
 * Visual pattern: preset-card grid + Section cards matching SkrankeTab / web-settings.jsx.
 *
 * Cards:
 *   1. Tilstedeværelse — 2x2 preset grid (BotOff / AtSign / Lightbulb / Sparkles)
 *      Active: brand-orange border + ring-[3px] + 2-line dashed consequence strip
 *      full_agent card gets mono "C4 påkrevd" badge
 *   2. Stemme — Section ToggleRow (shown when level !== 'off')
 *      When on: ADR-0078 red panel (bg-destructive/8 border-l-2 border-destructive)
 *   3. Capabilities — Section card with 4 ToggleRows + icons (shown when read_suggest or full_agent)
 *      Schedule / Contracts / Payroll / Helpdesk — each gets mono (C4) badge when full_agent
 *   4. Datasensitivitet — read-only softer card (bg-muted/40), shield icon, value badge
 *      derived from channel name keywords: lønn|hr|helse → Høy, prosjekt|generell → Lav, else Middels
 *
 * ADR-0078: Stemme-Botsson forbudt i kanaler med personnummer/bank/adresse/helseinfo.
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import {
  AtSign,
  BotOff,
  CalendarDays,
  Clock,
  FileText,
  LifeBuoy,
  Lightbulb,
  Loader2,
  Mic,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@smartout/i18n";
import { useWorkspaceAdmin } from "../_hooks/use-workspace-admin";
import { useWorkspace } from "@/lib/workspace-context";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { upsertChannelAiPolicy } from "../_actions/ai-policy-channel-actions";
import type { Database } from "@smartout/supabase";

type TextMode = Database["public"]["Enums"]["channel_ai_text_mode"];
type VoiceMode = Database["public"]["Enums"]["channel_ai_voice_mode"];
type AiAccessLevel = "off" | "mention_only" | "read_suggest" | "full_agent";

type AiPolicyTabProps = {
  channelId: string;
  channelName: string;
  /** True if the channel is a private-mode HR helpdesk (triggers ADR-0078 warning) */
  isSensitiveChannel?: boolean;
  onSettled?: () => void;
  onCancel?: () => void;
};

// Infer the 4-level access model from DB participation values
function participationToLevel(text: TextMode, voice: VoiceMode): AiAccessLevel {
  if (text === "disabled") return "off";
  if (text === "mention_only") return "mention_only";
  if (text === "proactive" && voice === "listen_only") return "read_suggest";
  if (text === "proactive" && voice === "interactive") return "full_agent";
  return "mention_only"; // fallback
}

/**
 * Derive a data sensitivity level from channel name keywords.
 * lønn|hr|helse|personal|sykemelding → Høy
 * prosjekt|generell|arrangement|social → Lav
 * everything else → Middels
 */
function deriveSensitivityLevel(channelName: string): "low" | "medium" | "high" {
  const name = channelName.toLowerCase();
  if (/lønn|hr|helse|personal|sykemelding|oppsigelse/.test(name)) return "high";
  if (/prosjekt|generell|arrangement|social|allmenn/.test(name)) return "low";
  return "medium";
}

function useChannelAiPolicy(channelId: string) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ["channel-ai-policy", workspace.workspace_id, channelId],
    staleTime: 15_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("channel_ai_policy")
        .select(
          "text_participation, voice_participation, auto_reminders, auto_summarize, auto_shift_prep",
        )
        .eq("channel_id", channelId)
        .maybeSingle();
      return data;
    },
  });
}

export function AiPolicyTab({
  channelId,
  channelName,
  isSensitiveChannel = false,
  onSettled,
  onCancel,
}: AiPolicyTabProps) {
  const { t } = useTranslation("helpdesk");
  const { data: isAdmin } = useWorkspaceAdmin();
  const { data: policy } = useChannelAiPolicy(channelId);

  const initialLevel: AiAccessLevel = policy
    ? participationToLevel(policy.text_participation, policy.voice_participation)
    : "off";

  const [accessLevel, setAccessLevel] = React.useState<AiAccessLevel>(initialLevel);
  const [autoReminders, setAutoReminders] = React.useState(policy?.auto_reminders ?? false);
  const [autoSummarize, setAutoSummarize] = React.useState(policy?.auto_summarize ?? false);
  const [autoShiftPrep, setAutoShiftPrep] = React.useState(policy?.auto_shift_prep ?? false);
  // Capability toggles per spec (schedule, contracts, payroll, helpdesk)
  const [capSchedule, setCapSchedule] = React.useState(true);
  const [capContracts, setCapContracts] = React.useState(true);
  const [capPayroll, setCapPayroll] = React.useState(false);
  const [capHelpdesk, setCapHelpdesk] = React.useState(true);
  // Voice override for ADR-0078 sensitive channels
  const [voiceEnabled, setVoiceEnabled] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const sensitivityLevel = deriveSensitivityLevel(channelName);

  // Sync when policy loads
  React.useEffect(() => {
    if (policy) {
      setAccessLevel(participationToLevel(policy.text_participation, policy.voice_participation));
      setAutoReminders(policy.auto_reminders);
      setAutoSummarize(policy.auto_summarize);
      setAutoShiftPrep(policy.auto_shift_prep);
    }
  }, [policy]);

  // Voice warning: ADR-0078 forbids voice on channels with sensitive data
  const showVoiceAdr0078Warning = voiceEnabled && isSensitiveChannel;
  // Show capability card when bot is actually reading/acting
  const showCapabilityCard = accessLevel === "read_suggest" || accessLevel === "full_agent";
  const isFullAgent = accessLevel === "full_agent";

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertChannelAiPolicy({
        channel_id: channelId,
        access_level: accessLevel,
        auto_reminders: autoReminders,
        auto_summarize: autoSummarize,
        auto_shift_prep: autoShiftPrep,
        voice_override: voiceEnabled,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.ai_saved"));
      onSettled?.();
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[20px] tracking-tight">
            {t("channel_settings.ai_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.ai_lede")}
          </p>
        </div>

        {/* Card 1 — Tilstedeværelse: 2x2 preset grid */}
        <fieldset
          aria-label={t("channel_settings.ai_level_group_label")}
          className="mb-5 grid grid-cols-2 gap-3"
        >
          <legend className="sr-only">{t("channel_settings.ai_level_group_label")}</legend>

          {/* Av */}
          <AiPresetCard
            id="off"
            selected={accessLevel === "off"}
            icon={<BotOff className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("channel_settings.ai_level_off_label")}
            lede={t("channel_settings.ai_level_off_lede")}
            consequenceDo={t("channel_settings.ai_level_off_consequence_do")}
            consequenceDont={t("channel_settings.ai_level_off_consequence_dont")}
            disabled={!isAdmin}
            onSelect={() => isAdmin && setAccessLevel("off")}
          />

          {/* Nevnt-kun */}
          <AiPresetCard
            id="mention_only"
            selected={accessLevel === "mention_only"}
            icon={<AtSign className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("channel_settings.ai_level_mention_label")}
            lede={t("channel_settings.ai_level_mention_lede")}
            consequenceDo={t("channel_settings.ai_level_mention_consequence_do")}
            consequenceDont={t("channel_settings.ai_level_mention_consequence_dont")}
            disabled={!isAdmin}
            onSelect={() => isAdmin && setAccessLevel("mention_only")}
          />

          {/* Les + foreslå */}
          <AiPresetCard
            id="read_suggest"
            selected={accessLevel === "read_suggest"}
            icon={<Lightbulb className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("channel_settings.ai_level_suggest_label")}
            lede={t("channel_settings.ai_level_suggest_lede")}
            consequenceDo={t("channel_settings.ai_level_suggest_consequence_do")}
            consequenceDont={t("channel_settings.ai_level_suggest_consequence_dont")}
            disabled={!isAdmin}
            onSelect={() => isAdmin && setAccessLevel("read_suggest")}
          />

          {/* Full agent — C4 badge */}
          <AiPresetCard
            id="full_agent"
            selected={accessLevel === "full_agent"}
            icon={<Sparkles className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
            title={t("channel_settings.ai_level_agent_label")}
            lede={t("channel_settings.ai_level_agent_lede")}
            consequenceDo={t("channel_settings.ai_level_agent_consequence_do")}
            consequenceDont={t("channel_settings.ai_level_agent_consequence_dont")}
            badge="C4 påkrevd"
            disabled={!isAdmin}
            onSelect={() => isAdmin && setAccessLevel("full_agent")}
          />
        </fieldset>

        {/* Card 2 — Stemme (Section ToggleRow, only when bot is not fully off) */}
        {accessLevel !== "off" && (
          <div className="bg-card border-border mb-5 rounded-2xl border p-5">
            <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
              {t("channel_settings.ai_voice_heading")}
            </div>

            {/* Toggle row */}
            <label className="flex cursor-pointer items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-muted mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
                  <Mic className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {t("channel_settings.ai_voice_toggle_label")}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {t("channel_settings.ai_voice_toggle_sub")}
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={voiceEnabled}
                onChange={(e) => isAdmin && setVoiceEnabled(e.target.checked)}
                disabled={!isAdmin}
                className="accent-brand-orange mt-0.5 h-4 w-4 flex-shrink-0"
              />
            </label>

            {/* ADR-0078 warning panel — shown when voice on + sensitive channel */}
            {showVoiceAdr0078Warning && (
              <div className="bg-destructive/8 border-destructive mt-3 rounded-md border-l-2 p-3">
                <p className="text-destructive font-mono text-[11px] leading-relaxed">
                  ADR-0078: Stemme-Botsson forbudt i kanaler med
                  personnummer/bank/adresse/helseinfo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Card 3 — Capabilities (Section card, 4 ToggleRows with icons) */}
        {showCapabilityCard && (
          <div className="bg-card border-border mb-5 rounded-2xl border p-5">
            <div className="text-muted-foreground mb-3 font-mono text-[11px] font-semibold tracking-[0.06em] uppercase">
              {t("channel_settings.ai_capabilities_heading")}
            </div>

            <div className="divide-border divide-y">
              <CapabilityRow
                icon={<CalendarDays className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
                label={t("channel_settings.ai_cap_schedule_label")}
                sub={t("channel_settings.ai_cap_reminders_sub")}
                checked={capSchedule}
                onChange={setCapSchedule}
                disabled={!isAdmin || isPending}
                c4Badge={isFullAgent}
              />
              <CapabilityRow
                icon={<FileText className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
                label={t("channel_settings.ai_cap_contracts_label")}
                sub={t("channel_settings.ai_cap_summarize_sub")}
                checked={capContracts}
                onChange={setCapContracts}
                disabled={!isAdmin || isPending}
                c4Badge={isFullAgent}
              />
              <CapabilityRow
                icon={<Wallet className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
                label={t("channel_settings.ai_cap_payroll_label")}
                sub={t("channel_settings.ai_cap_shift_prep_sub")}
                checked={capPayroll}
                onChange={setCapPayroll}
                disabled={!isAdmin || isPending}
                c4Badge={isFullAgent}
              />
              <CapabilityRow
                icon={<LifeBuoy className="text-muted-foreground h-4 w-4" aria-hidden="true" />}
                label={t("channel_settings.ai_cap_helpdesk_label")}
                sub={t("channel_settings.ai_cap_reminders_sub")}
                checked={capHelpdesk}
                onChange={setCapHelpdesk}
                disabled={!isAdmin || isPending}
                c4Badge={isFullAgent}
              />
            </div>
          </div>
        )}

        {/* Card 4 — Datasensitivitet (read-only, softer bg-muted/40) */}
        <div className="border-border bg-muted/40 rounded-2xl border p-5">
          <div className="flex items-center gap-2.5">
            <div className="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
              <Shield className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {t("channel_settings.ai_sensitivity_label")}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("channel_settings.ai_sensitivity_sub")}
              </div>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide uppercase",
                sensitivityLevel === "high"
                  ? "bg-destructive/15 text-destructive"
                  : sensitivityLevel === "medium"
                    ? "bg-warning/15 text-warning-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {sensitivityLevel === "high"
                ? t("channel_settings.ai_sensitivity_high")
                : sensitivityLevel === "medium"
                  ? t("channel_settings.ai_sensitivity_medium")
                  : t("channel_settings.ai_sensitivity_low")}
            </span>
          </div>
        </div>
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
              disabled={isPending}
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

// ── AI Preset Card ────────────────────────────────────────────

type AiPresetCardProps = {
  id: AiAccessLevel;
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  lede: string;
  /** First consequence line → "Hva bot gjør" */
  consequenceDo: string;
  /** Second consequence line → "Hva bot ikke gjør" */
  consequenceDont: string;
  /** Optional mono badge (e.g. "C4 påkrevd") shown inline next to title */
  badge?: string;
  disabled?: boolean;
  onSelect: () => void;
};

function AiPresetCard({
  id,
  selected,
  icon,
  title,
  lede,
  consequenceDo,
  consequenceDont,
  badge,
  disabled,
  onSelect,
}: AiPresetCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-ai-level={id}
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
        {/* Radio indicator */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
            selected ? "border-brand-orange" : "border-muted-foreground/50",
          )}
        >
          {selected && <span className="bg-brand-orange h-2 w-2 rounded-full" />}
        </span>

        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {icon}
            <div className="text-sm font-semibold tracking-[-0.005em]">{title}</div>
            {badge && (
              <span className="text-muted-foreground bg-muted rounded border border-current/20 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wide uppercase">
                {badge}
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-sm leading-[1.5]">{lede}</div>

          {/* 2-line consequence strip (active only) */}
          {selected && (
            <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] leading-relaxed tracking-[0.01em]">
              <div>→ {consequenceDo}</div>
              <div>→ {consequenceDont}</div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Capability Row (Section-card divider row with icon) ───────

type CapabilityRowProps = {
  icon: React.ReactNode;
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Show mono (C4) badge when full_agent is active */
  c4Badge?: boolean;
};

function CapabilityRow({
  icon,
  label,
  sub,
  checked,
  onChange,
  disabled,
  c4Badge,
}: CapabilityRowProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <div className="bg-muted flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            {c4Badge && (
              <span className="text-muted-foreground bg-muted rounded border border-current/20 px-1 py-0.5 font-mono text-[10px] tracking-wide uppercase">
                C4
              </span>
            )}
          </div>
          <div className="text-muted-foreground text-xs">{sub}</div>
        </div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="accent-brand-orange mt-0.5 h-4 w-4 flex-shrink-0"
      />
    </label>
  );
}
