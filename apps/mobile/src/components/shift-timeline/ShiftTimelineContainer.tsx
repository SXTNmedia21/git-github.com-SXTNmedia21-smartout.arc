/**
 * ShiftTimelineContainer — Host-level integration for ShiftTimeline.
 *
 * Binds the presentational `ShiftTimeline` to the mobile Botsson provider,
 * NetInfo online status, and the telemetry bus. Council 6.4 (2026-04-15):
 *
 * - Deep-link to Botsson uses `BotssonProvider.openWithIntent` (NOT
 *   AsyncStorage).
 * - Voice interlock (ADR-0078): when status='active' and mode='voice', the
 *   deviation button refuses with a toast. The PII defence-in-depth rules
 *   out both "silently end voice" and "queue for later" — we make the
 *   refusal visible so the employee understands why the action is blocked.
 * - Offline: the orb freezes and the deviation click emits a toast via
 *   the presentational component's `onOfflineDeviationAttempt` callback.
 *
 * Telemetry:
 * - shift_lifecycle deviation_bridge_opened — on successful openWithIntent
 * - shift_lifecycle deviation_bridge_refused — when voice interlock or
 *   offline blocks the action (with `reason`).
 */

import React, { useCallback } from "react";
import { Alert } from "react-native";
import { useTranslation } from "@smartout/i18n";
import { emit, nonEmpty } from "@smartout/telemetry";

import { useBotsson } from "@/providers/botsson-provider";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useShiftLifecycle } from "@/hooks/useShiftLifecycle";
import { useMyProfile } from "@/hooks/queries/use-my-profile";

import { ShiftTimeline } from "./ShiftTimeline";
import type { ShiftLifecyclePhase, TimelineBotssonIntent } from "./types";

type ShiftTimelineContainerProps = {
  shiftId: string;
};

export function ShiftTimelineContainer({ shiftId }: ShiftTimelineContainerProps) {
  const { t } = useTranslation("shift");
  const botsson = useBotsson();
  const isOnline = useIsOnline();
  const { data: lifecycle, dataUpdatedAt } = useShiftLifecycle(shiftId);
  const { data: profile } = useMyProfile();
  const workspaceId = profile?.workspace_id ?? null;
  const actorId = profile?.profile_id ?? "anonymous";

  const handleOpenBotsson = useCallback(
    (intent: TimelineBotssonIntent) => {
      // Voice interlock (ADR-0078): never open a deviation bridge while a
      // voice session is active. Voice + PII is a security boundary we must
      // not cross even transiently.
      if (botsson.status === "active" && botsson.mode === "voice") {
        void emit({
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(actorId, "actor_id"),
          event: "shift_lifecycle deviation_bridge_refused",
          properties: {
            data: {
              shift_id: intent.shift_id,
              reason: "voice_active",
              phase: intent.phase,
            },
          },
        });
        Alert.alert(t("timeline.voice.end_first"));
        return;
      }

      botsson.openWithIntent({
        kind: intent.kind,
        shift_id: intent.shift_id,
        deviation_id: intent.deviation_id ?? null,
        phase: intent.phase,
      });
      void emit({
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        event: "shift_lifecycle deviation_bridge_opened",
        properties: {
          data: {
            shift_id: intent.shift_id,
            phase: intent.phase,
            has_deviation_id: Boolean(intent.deviation_id),
          },
        },
      });
    },
    [botsson, t, workspaceId, actorId],
  );

  const handleOfflineDeviationAttempt = useCallback(() => {
    void emit({
      workspace_id: nonEmpty(workspaceId, "workspace_id"),
      actor_id: nonEmpty(actorId, "actor_id"),
      event: "shift_lifecycle deviation_bridge_refused",
      properties: {
        data: {
          shift_id: shiftId,
          reason: "offline",
        },
      },
    });
    Alert.alert(t("timeline.offline.deviation_disabled"));
  }, [shiftId, t, workspaceId, actorId]);

  const handleLongPressPhase = useCallback((_phase: ShiftLifecyclePhase) => {
    // Container only participates if telemetry is required later; the
    // presentational component owns the tooltip reveal.
  }, []);

  if (!lifecycle) return null;

  return (
    <ShiftTimeline
      lifecycle={lifecycle}
      onOpenBotsson={handleOpenBotsson}
      onLongPressPhase={handleLongPressPhase}
      frozen={!isOnline}
      lastUpdatedAt={dataUpdatedAt ?? null}
      onOfflineDeviationAttempt={handleOfflineDeviationAttempt}
    />
  );
}
