"use client";

/**
 * AiPolicyTab — Botsson AI access configuration for a channel.
 *
 * Four radio preset cards (matching SkrankeTab visual pattern):
 *   - Av              → text=disabled, voice=disabled
 *   - Nevnt-kun       → text=mention_only, voice=disabled
 *   - Les + foreslå   → text=proactive, voice=listen_only
 *   - Full agent      → text=proactive, voice=interactive
 *
 * Per-capability toggles (shown when level != 'off'):
 *   - auto_reminders, auto_summarize, auto_shift_prep
 *
 * Voice restriction toggle with ADR-0078 warning for sensitive channels.
 *
 * Nordic Split tokens only. Lucide icons only.
 */

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Bot, Clock, Loader2, Mic, MicOff, Zap } from "lucide-react";
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
  channelName: _channelName,
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
  const [voiceOverride, setVoiceOverride] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Sync when policy loads
  React.useEffect(() => {
    if (policy) {
      setAccessLevel(participationToLevel(policy.text_participation, policy.voice_participation));
      setAutoReminders(policy.auto_reminders);
      setAutoSummarize(policy.auto_summarize);
      setAutoShiftPrep(policy.auto_shift_prep);
    }
  }, [policy]);

  const showCapabilityToggles = accessLevel !== "off";
  const showVoiceWarning = isSensitiveChannel && accessLevel === "full_agent" && !voiceOverride;

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertChannelAiPolicy({
        channel_id: channelId,
        access_level: accessLevel,
        auto_reminders: autoReminders,
        auto_summarize: autoSummarize,
        auto_shift_prep: autoShiftPrep,
        voice_override: voiceOverride,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t("channel_settings.ai_saved"));
      onSettled?.();
    });
  };

  const presets: Array<{
    id: AiAccessLevel;
    title: string;
    lede: string;
    consequence?: string;
    warn?: string;
    icon?: React.ReactNode;
  }> = [
    {
      id: "off",
      icon: <MicOff className="text-muted-foreground h-4 w-4" aria-hidden="true" />,
      title: t("channel_settings.ai_level_off_label"),
      lede: t("channel_settings.ai_level_off_lede"),
    },
    {
      id: "mention_only",
      icon: <Bot className="text-muted-foreground h-4 w-4" aria-hidden="true" />,
      title: t("channel_settings.ai_level_mention_label"),
      lede: t("channel_settings.ai_level_mention_lede"),
      consequence: t("channel_settings.ai_level_mention_consequence"),
    },
    {
      id: "read_suggest",
      icon: <Zap className="text-muted-foreground h-4 w-4" aria-hidden="true" />,
      title: t("channel_settings.ai_level_suggest_label"),
      lede: t("channel_settings.ai_level_suggest_lede"),
      consequence: t("channel_settings.ai_level_suggest_consequence"),
    },
    {
      id: "full_agent",
      icon: <Zap className="text-muted-foreground h-4 w-4" aria-hidden="true" />,
      title: t("channel_settings.ai_level_agent_label"),
      lede: t("channel_settings.ai_level_agent_lede"),
      consequence: t("channel_settings.ai_level_agent_consequence"),
      warn: isSensitiveChannel ? t("channel_settings.ai_level_agent_warn_sensitive") : undefined,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto px-8 pt-7 pb-8">
        {/* Section intro */}
        <div className="mb-[22px]">
          <div className="font-heading mb-1 text-[22px] tracking-tight">
            {t("channel_settings.ai_heading")}
          </div>
          <p className="text-muted-foreground max-w-[560px] text-sm">
            {t("channel_settings.ai_lede")}
          </p>
        </div>

        {/* Access level preset grid (2-col, matching SkrankeTab) */}
        <fieldset
          aria-label={t("channel_settings.ai_level_group_label")}
          className="mb-6 grid grid-cols-2 gap-3"
        >
          <legend className="sr-only">{t("channel_settings.ai_level_group_label")}</legend>
          {presets.map((preset) => {
            const selected = accessLevel === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => isAdmin && setAccessLevel(preset.id)}
                disabled={!isAdmin}
                className={cn(
                  "bg-card relative rounded-[14px] border p-[18px] text-left transition-[border-color,box-shadow] duration-[180ms] ease-out",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  selected
                    ? "border-brand-orange ring-brand-orange/12 ring-[3px]"
                    : "border-border hover:border-foreground/20",
                  !isAdmin && "cursor-not-allowed opacity-60",
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
                    <div className="mb-1 flex items-center gap-2">
                      {preset.icon}
                      <div className="text-[15px] font-semibold tracking-[-0.005em]">
                        {preset.title}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-[13px] leading-[1.5]">
                      {preset.lede}
                    </div>
                    {/* Consequence strip (active only) */}
                    {preset.consequence && selected && (
                      <div className="border-border text-muted-foreground mt-2.5 border-t border-dashed pt-2.5 font-mono text-[12px] tracking-[0.01em]">
                        → {preset.consequence}
                      </div>
                    )}
                    {/* ADR-0078 warn strip */}
                    {preset.warn && selected && (
                      <div className="bg-warning/10 border-warning text-warning-foreground mt-2.5 rounded border-l-2 px-2.5 py-2 text-[12px]">
                        {preset.warn}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </fieldset>

        {/* Per-capability toggles (only when AI is active) */}
        {showCapabilityToggles && (
          <div className="bg-card border-border mb-5 rounded-2xl border p-5">
            <div className="mb-3.5 text-sm font-semibold">
              {t("channel_settings.ai_capabilities_heading")}
            </div>
            <div className="space-y-3">
              <ToggleRow
                checked={autoReminders}
                onChange={setAutoReminders}
                disabled={!isAdmin || isPending}
                label={t("channel_settings.ai_cap_reminders_label")}
                sub={t("channel_settings.ai_cap_reminders_sub")}
              />
              <ToggleRow
                checked={autoSummarize}
                onChange={setAutoSummarize}
                disabled={!isAdmin || isPending}
                label={t("channel_settings.ai_cap_summarize_label")}
                sub={t("channel_settings.ai_cap_summarize_sub")}
              />
              <ToggleRow
                checked={autoShiftPrep}
                onChange={setAutoShiftPrep}
                disabled={!isAdmin || isPending}
                label={t("channel_settings.ai_cap_shift_prep_label")}
                sub={t("channel_settings.ai_cap_shift_prep_sub")}
              />
            </div>
          </div>
        )}

        {/* ADR-0078 voice override (only shown when full_agent + sensitive channel) */}
        {isSensitiveChannel && accessLevel === "full_agent" && (
          <div className="border-warning bg-warning/5 mb-5 flex gap-3.5 rounded-2xl border p-4">
            <AlertTriangle
              className="text-warning mt-0.5 h-4 w-4 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="flex-1">
              <div className="mb-1.5 text-[13px] font-semibold">
                {t("channel_settings.ai_voice_warning_title")}
              </div>
              <div className="text-muted-foreground mb-3 text-xs leading-relaxed">
                {t("channel_settings.ai_voice_warning_body")}
              </div>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={voiceOverride}
                  onChange={(e) => setVoiceOverride(e.target.checked)}
                  disabled={!isAdmin}
                  className="accent-brand-orange h-4 w-4"
                />
                <span className="text-xs font-medium">
                  {t("channel_settings.ai_voice_override_label")}
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Voice mode indicator (read-only) */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-[12px]">
          <Mic className="h-3 w-3" aria-hidden="true" />
          <span className="font-mono">
            {t("channel_settings.ai_voice_mode_label")}:{" "}
            {accessLevel === "full_agent" && (voiceOverride || !isSensitiveChannel)
              ? t("channel_settings.ai_voice_mode_interactive")
              : accessLevel === "read_suggest"
                ? t("channel_settings.ai_voice_mode_listen")
                : t("channel_settings.ai_voice_mode_off")}
          </span>
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
              disabled={isPending || (showVoiceWarning && accessLevel === "full_agent")}
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

// ── Internal toggle row ──────────────────────────────────────

type ToggleRowProps = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  sub: string;
};

function ToggleRow({ checked, onChange, disabled, label, sub }: ToggleRowProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-muted-foreground text-xs">{sub}</div>
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
