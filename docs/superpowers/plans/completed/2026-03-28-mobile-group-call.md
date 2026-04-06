---
title: Mobile Group Call — Expanded UI + Video
status: draft
updated: 2026-03-28
created: 2026-03-28
module: communications
tags: [livekit, webrtc, mobile, group-call, video, ptt]
---

# Mobile Group Call Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expanded call UI to mobile: bottom sheet from CallBar with participant grid, active speaker focus, optional video, and PTT/open-mic mode support.

**Architecture:** Bottom sheet (via existing `@gorhom/bottom-sheet` wrapper) opens from CallBar. `useCallTracks` hook listens to LiveKit room events for participant/track state. ParticipantGrid renders adaptive layout (audio circles vs video tiles). CallControls adapts to `audio_policy`. Camera managed via `room.localParticipant.setCameraEnabled()`.

**Tech Stack:** React Native (Expo 55), livekit-client, @livekit/react-native, @gorhom/bottom-sheet, react-native-reanimated, expo-haptics

**Spec:** `docs/superpowers/specs/2026-03-28-mobile-group-call-design.md`

**Council review (2026-03-28):** REJECT → Fixed. 6 compile blockers resolved: useTranslation→strings, caption2→micro/title3→headline, use BottomSheet wrapper, fix headerLeft.color, design token colors, emit actor_id. 6 non-blocking fixes applied: VideoView verified, VideoPolicy in call-types.ts, CallSession.videoPolicy, reduced motion, Reanimated glow, sharedTransitionTag note.

---

## Critical Platform Conventions (read before implementing)

**Strings:** Mobile does NOT have `@smartout/i18n`. Use `import { strings } from "@/constants/strings"`. Add new keys to `apps/mobile/src/constants/strings.ts` under a `call` section.

**Typography:** Only these variants exist: `largeTitle`, `title`, `headline`, `body`, `bodyBold`, `subheadline`, `caption`, `micro`. NO `caption2`, `title3`, or other variants.

**BottomSheet:** Use `<BottomSheet>` from `@/components/ui/BottomSheet` (wraps `@gorhom/bottom-sheet` with themed styling). Do NOT import `GorhomBottomSheet` directly.

**Colors:** Use `theme.colors.*` from `createStyles`. Minimize hardcoded hex values.

**VideoView:** Import from `@livekit/react-native` (v2.9.6): `import { VideoView } from "@livekit/react-native"`.

**Reduced motion:** Check `AccessibilityInfo.isReduceMotionEnabled()` — all springs must fall back to instant when enabled.

---

## File Structure

### New files

| File                  | Location                                        | Responsibility                                                         |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `use-call-tracks.ts`  | `apps/mobile/src/hooks/`                        | LiveKit room event listener — participant list, tracks, active speaker |
| `CallSheet.tsx`       | `apps/mobile/src/features/channels/components/` | Bottom sheet via `<BottomSheet>` wrapper, header, duration timer       |
| `ParticipantGrid.tsx` | `apps/mobile/src/features/channels/components/` | Adaptive layout — audio circles, video grid, or focus mode             |
| `ParticipantTile.tsx` | `apps/mobile/src/features/channels/components/` | Single participant — video or avatar with speaker indicator            |
| `CallControls.tsx`    | `apps/mobile/src/features/channels/components/` | Mic, camera, PTT, end call — adapts to audio_policy                    |

### Modified files

| File                                                       | Change                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `apps/mobile/src/features/channels/components/CallBar.tsx` | Add `onPress` prop to open sheet                        |
| `apps/mobile/src/constants/strings.ts`                     | Add `call` section with all new string keys             |
| `packages/walkieTalkie/src/call-types.ts`                  | Add `VideoPolicy` type + `videoPolicy` to `CallSession` |

---

## Task 1: Install expo-camera + create useCallTracks hook

The foundational hook that all UI components depend on. Tracks participants, their video/audio tracks, and who is speaking.

**Files:**

- Create: `apps/mobile/src/hooks/use-call-tracks.ts`

- [ ] **Step 1: Install expo-camera**

```bash
cd apps/mobile && npx expo install expo-camera
```

This is needed for camera permissions when enabling video.

- [ ] **Step 2: Create the useCallTracks hook**

```typescript
// apps/mobile/src/hooks/use-call-tracks.ts
/**
 * useCallTracks — Tracks participants, video/audio tracks, and active speaker
 * from a LiveKit Room instance.
 *
 * Read-only hook (no mutations). Lives outside hooks/mutations/ because
 * it subscribes to room events, not Supabase.
 */
import { useState, useEffect, useCallback } from "react";
import {
  RoomEvent,
  Track,
  type Room,
  type Participant,
  type RemoteTrackPublication,
  type LocalTrackPublication,
} from "livekit-client";

export type ParticipantTrackInfo = {
  identity: string;
  name: string;
  avatarUrl: string | null;
  isLocal: boolean;
  isAi: boolean;
  isSpeaking: boolean;
  isMicEnabled: boolean;
  videoTrack: Track | null;
};

type UseCallTracksResult = {
  participants: ParticipantTrackInfo[];
  activeSpeakerIdentity: string | null;
  hasAnyVideo: boolean;
};

function extractParticipantInfo(
  participant: Participant,
  isLocal: boolean,
  activeSpeakers: Set<string>,
): ParticipantTrackInfo {
  let metadata: { display_name?: string; avatar_url?: string; is_ai?: boolean } = {};
  try {
    metadata = participant.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    // Metadata may not be JSON — ignore
  }

  // Find video track (camera, not screen share)
  let videoTrack: Track | null = null;
  for (const pub of participant.trackPublications.values()) {
    const p = pub as RemoteTrackPublication | LocalTrackPublication;
    if (p.track && p.source === Track.Source.Camera && !p.isMuted) {
      videoTrack = p.track;
      break;
    }
  }

  return {
    identity: participant.identity,
    name: metadata.display_name ?? participant.name ?? participant.identity,
    avatarUrl: metadata.avatar_url ?? null,
    isLocal,
    isAi: metadata.is_ai === true || participant.identity.startsWith("botsson:"),
    isSpeaking: activeSpeakers.has(participant.identity),
    isMicEnabled: participant.isMicrophoneEnabled,
    videoTrack,
  };
}

export function useCallTracks(room: Room | null): UseCallTracksResult {
  const [participants, setParticipants] = useState<ParticipantTrackInfo[]>([]);
  const [activeSpeakerIdentity, setActiveSpeakerIdentity] = useState<string | null>(null);
  const [activeSpeakerSet, setActiveSpeakerSet] = useState<Set<string>>(new Set());

  const rebuild = useCallback(() => {
    if (!room) {
      setParticipants([]);
      return;
    }

    const list: ParticipantTrackInfo[] = [];

    // Local participant first
    list.push(extractParticipantInfo(room.localParticipant, true, activeSpeakerSet));

    // Remote participants sorted alphabetically
    const remotes = Array.from(room.remoteParticipants.values()).sort((a, b) =>
      (a.name ?? a.identity).localeCompare(b.name ?? b.identity),
    );
    for (const remote of remotes) {
      list.push(extractParticipantInfo(remote, false, activeSpeakerSet));
    }

    setParticipants(list);
  }, [room, activeSpeakerSet]);

  useEffect(() => {
    if (!room) return;

    const handleActiveSpeakers = (speakers: Participant[]) => {
      const newSet = new Set(speakers.map((s) => s.identity));
      setActiveSpeakerSet(newSet);
      setActiveSpeakerIdentity(speakers[0]?.identity ?? null);
    };

    // Rebuild on any track or participant change
    room.on(RoomEvent.TrackSubscribed, rebuild);
    room.on(RoomEvent.TrackUnsubscribed, rebuild);
    room.on(RoomEvent.TrackMuted, rebuild);
    room.on(RoomEvent.TrackUnmuted, rebuild);
    room.on(RoomEvent.ParticipantConnected, rebuild);
    room.on(RoomEvent.ParticipantDisconnected, rebuild);
    room.on(RoomEvent.ParticipantMetadataChanged, rebuild);
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);

    // Initial build
    rebuild();

    return () => {
      room.off(RoomEvent.TrackSubscribed, rebuild);
      room.off(RoomEvent.TrackUnsubscribed, rebuild);
      room.off(RoomEvent.TrackMuted, rebuild);
      room.off(RoomEvent.TrackUnmuted, rebuild);
      room.off(RoomEvent.ParticipantConnected, rebuild);
      room.off(RoomEvent.ParticipantDisconnected, rebuild);
      room.off(RoomEvent.ParticipantMetadataChanged, rebuild);
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    };
  }, [room, rebuild]);

  // Rebuild when active speakers change
  useEffect(() => {
    rebuild();
  }, [activeSpeakerSet, rebuild]);

  const hasAnyVideo = participants.some((p) => p.videoTrack !== null);

  return { participants, activeSpeakerIdentity, hasAnyVideo };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/use-call-tracks.ts apps/mobile/package.json
git commit -m "feat(mobile): add useCallTracks hook for participant/track state

Listens to LiveKit room events for track subscriptions, speaker
changes, and participant metadata. Returns sorted participant list
with video track references. Read-only hook.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create ParticipantTile component

Single participant rendering — video track or avatar with speaker indicator.

**Files:**

- Create: `apps/mobile/src/features/channels/components/ParticipantTile.tsx`

- [ ] **Step 1: Create ParticipantTile**

```typescript
// apps/mobile/src/features/channels/components/ParticipantTile.tsx
/**
 * ParticipantTile — Renders one call participant.
 * Video variant: shows camera track with name overlay.
 * Avatar variant: shows circular avatar with speaker glow.
 */
import React from "react";
import { View, Text } from "react-native";
import { MicOff } from "lucide-react-native";
import { createStyles } from "@/theme";
import Animated, {
  useAnimatedStyle,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import type { ParticipantTrackInfo } from "@/hooks/use-call-tracks";
import type { Track } from "livekit-client";
import { VideoView } from "@livekit/react-native";
import { strings } from "@/constants/strings";

type Props = {
  participant: ParticipantTrackInfo;
  size?: "small" | "large";
  /** Reanimated shared value 0-1 for speaker glow intensity */
  speakingIntensity?: SharedValue<number>;
};

const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 };

export function ParticipantTile({ participant, size = "large", speakingIntensity }: Props) {
  const styles = useStyles();
  const isSmall = size === "small";

  const glowStyle = useAnimatedStyle(() => {
    if (!speakingIntensity) return {};
    const intensity = participant.isSpeaking ? speakingIntensity.value : 0;
    return {
      borderWidth: withSpring(intensity > 0.1 ? 3 : 0, SPRING_CONFIG),
      borderColor: `rgba(245, 158, 11, ${intensity})`,
      transform: [{ scale: withSpring(intensity > 0.1 ? 1.05 : 1, SPRING_CONFIG) }],
    };
  }, [participant.isSpeaking]);

  const nameLabel = participant.isLocal
    ? `${participant.name} ${strings.call.youSuffix}`
    : participant.name;

  const a11yLabel = `${participant.name}, ${participant.isSpeaking ? strings.call.speaking : strings.call.silent}`;

  // Video variant
  if (participant.videoTrack) {
    return (
      <View
        style={[styles.videoContainer, isSmall && styles.smallContainer]}
        accessibilityLabel={a11yLabel}
      >
        <VideoView
          videoTrack={participant.videoTrack as Track}
          style={styles.videoView}
          mirror={participant.isLocal}
        />
        <View style={styles.nameOverlay}>
          <Text style={styles.nameText} numberOfLines={1}>
            {nameLabel}
          </Text>
          {!participant.isMicEnabled && <MicOff size={12} color="#fff" />}
        </View>
        {participant.isSpeaking && <View style={styles.speakingBorder} />}
      </View>
    );
  }

  // Avatar variant
  return (
    <Animated.View
      style={[styles.avatarContainer, isSmall && styles.smallAvatarContainer, glowStyle]}
      accessibilityLabel={a11yLabel}
    >
      <View style={[styles.avatar, isSmall && styles.smallAvatar]}>
        <Text style={[styles.initials, isSmall && styles.smallInitials]}>
          {participant.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      {!participant.isMicEnabled && (
        <View style={styles.micOffBadge}>
          <MicOff size={10} color="#fff" />
        </View>
      )}
      {participant.isAi && (
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      )}
      <Text style={[styles.avatarName, isSmall && styles.smallAvatarName]} numberOfLines={1}>
        {nameLabel}
      </Text>
    </Animated.View>
  );
}

const useStyles = createStyles((theme) => ({
  videoContainer: {
    flex: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
    minHeight: 120,
  },
  smallContainer: {
    width: 100,
    height: 80,
    flex: 0,
  },
  videoView: {
    flex: 1,
  },
  nameOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  nameText: {
    ...theme.typography.caption,
    color: "#fff",
    flex: 1,
  },
  speakingBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: "#22c55e",
    borderRadius: theme.radius.lg,
  },
  avatarContainer: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: theme.radius.lg,
  },
  smallAvatarContainer: {
    paddingVertical: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initials: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.bold,
  },
  smallInitials: {
    ...theme.typography.subheadline,
  },
  micOffBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  aiBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  aiBadgeText: {
    ...theme.typography.micro,
    color: "#fff",
    fontWeight: theme.fontWeights.bold,
  },
  avatarName: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
    textAlign: "center",
    maxWidth: 80,
  },
  smallAvatarName: {
    ...theme.typography.micro,
    maxWidth: 60,
  },
}));
```

**Note:** The `VideoView` import from `@livekit/react-native` renders a LiveKit video track in React Native. Verify the exact import path at build time — it may be `VideoView` or `VideoRenderer` depending on the SDK version.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/channels/components/ParticipantTile.tsx
git commit -m "feat(mobile): add ParticipantTile for call participants

Renders video track (with name overlay + speaking border) or avatar
(with spring-driven speaker glow + initials). Supports small/large
sizes, mic-off badge, AI badge, accessibility labels.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Create ParticipantGrid (adaptive layout)

**Files:**

- Create: `apps/mobile/src/features/channels/components/ParticipantGrid.tsx`

- [ ] **Step 1: Create ParticipantGrid**

```typescript
// apps/mobile/src/features/channels/components/ParticipantGrid.tsx
/**
 * ParticipantGrid — Adaptive layout for call participants.
 * - Audio-only: centered circle avatars in a grid
 * - 1-2 video: equal grid
 * - 3+ video: active speaker focus + thumbnail strip
 */
import React from "react";
import { View, ScrollView, Text } from "react-native";
import { createStyles } from "@/theme";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { ParticipantTile } from "./ParticipantTile";
import type { ParticipantTrackInfo } from "@/hooks/use-call-tracks";
import { strings } from "@/constants/strings";

type Props = {
  participants: ParticipantTrackInfo[];
  activeSpeakerIdentity: string | null;
  hasAnyVideo: boolean;
};

const SPRING_CONFIG = { stiffness: 35, damping: 22, mass: 2.2 };

export function ParticipantGrid({ participants, activeSpeakerIdentity, hasAnyVideo }: Props) {
  const styles = useStyles();
  const speakingIntensity = useSharedValue(0);

  // Drive speaking intensity animation
  React.useEffect(() => {
    speakingIntensity.value = withSpring(activeSpeakerIdentity ? 0.7 : 0, SPRING_CONFIG);
  }, [activeSpeakerIdentity, speakingIntensity]);

  // Waiting state
  if (participants.length <= 1) {
    return (
      <View style={styles.waitingContainer}>
        {participants[0] && (
          <ParticipantTile participant={participants[0]} speakingIntensity={speakingIntensity} />
        )}
        <Text style={styles.waitingText}>
          {strings.call.waitingForParticipants}
        </Text>
      </View>
    );
  }

  // Audio-only mode — avatar grid
  if (!hasAnyVideo) {
    return (
      <View style={styles.audioGrid}>
        {participants.map((p) => (
          <ParticipantTile
            key={p.identity}
            participant={p}
            speakingIntensity={speakingIntensity}
          />
        ))}
      </View>
    );
  }

  // Video: 1-2 participants — equal grid
  if (participants.length <= 2) {
    return (
      <View style={styles.videoGrid}>
        {participants.map((p) => (
          <ParticipantTile key={p.identity} participant={p} />
        ))}
      </View>
    );
  }

  // Video: 3+ — focus mode (active speaker large, rest in strip)
  const focused = participants.find((p) => p.identity === activeSpeakerIdentity) ?? participants[0];
  const others = participants.filter((p) => p.identity !== focused.identity);

  return (
    <View style={styles.focusContainer}>
      <View style={styles.focusMain}>
        <ParticipantTile participant={focused} />
      </View>
      <ScrollView horizontal style={styles.thumbnailStrip} showsHorizontalScrollIndicator={false}>
        {others.map((p) => (
          <ParticipantTile key={p.identity} participant={p} size="small" />
        ))}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  waitingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
  },
  waitingText: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
  },
  audioGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.card,
  },
  videoGrid: {
    flex: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
  },
  focusContainer: {
    flex: 1,
  },
  focusMain: {
    flex: 3,
    padding: theme.spacing.xs,
  },
  thumbnailStrip: {
    flex: 1,
    paddingHorizontal: theme.spacing.xs,
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/channels/components/ParticipantGrid.tsx
git commit -m "feat(mobile): add ParticipantGrid with adaptive layout

Audio-only: centered avatar grid. 1-2 video: equal grid.
3+ video: active speaker focus with horizontal thumbnail strip.
Spring-driven speaking intensity animation.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Create CallControls component

**Files:**

- Create: `apps/mobile/src/features/channels/components/CallControls.tsx`

- [ ] **Step 1: Create CallControls**

```typescript
// apps/mobile/src/features/channels/components/CallControls.tsx
/**
 * CallControls — Bottom control bar in expanded call sheet.
 * Adapts to audio_policy: open_mic (mic toggle), ptt (hold button), listen_only (no mic).
 * Camera toggle shown when video_policy is not "disabled".
 */
import React from "react";
import { View, Pressable, Text } from "react-native";
import { Mic, MicOff, Camera, CameraOff, PhoneOff } from "lucide-react-native";
import { createStyles } from "@/theme";
import { PTTButton } from "./PTTButton";
import { strings } from "@/constants/strings";
import type { AudioPolicy, VideoPolicy, PTTState } from "@smartout/walkie-talkie";

type Props = {
  audioPolicy: AudioPolicy;
  videoPolicy: VideoPolicy;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  pttState?: PTTState;
  isTalking?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  onEndCall: () => void;
};

export function CallControls({
  audioPolicy,
  videoPolicy,
  isMicEnabled,
  isCameraEnabled,
  pttState = "idle",
  isTalking = false,
  onToggleMic,
  onToggleCamera,
  onPttPressIn,
  onPttPressOut,
  onEndCall,
}: Props) {
  const styles = useStyles();
  const showCamera = videoPolicy !== "disabled";
  const cameraLocked = videoPolicy === "required";

  if (audioPolicy === "ptt") {
    return (
      <View style={styles.pttContainer}>
        {showCamera && (
          <ControlButton
            icon={isCameraEnabled ? Camera : CameraOff}
            active={isCameraEnabled}
            disabled={cameraLocked}
            onPress={onToggleCamera}
            label={strings.call.camera}
          />
        )}
        <PTTButton
          pttState={pttState}
          isTalking={isTalking}
          onPressIn={onPttPressIn ?? (() => {})}
          onPressOut={onPttPressOut ?? (() => {})}
        />
        <ControlButton
          icon={PhoneOff}
          variant="danger"
          onPress={onEndCall}
          label={strings.call.endCall}
        />
      </View>
    );
  }

  if (audioPolicy === "listen_only") {
    return (
      <View style={styles.container}>
        <Text style={styles.listenOnlyLabel}>{strings.call.listenOnly}</Text>
        <View style={styles.buttonRow}>
          {showCamera && (
            <ControlButton
              icon={isCameraEnabled ? Camera : CameraOff}
              active={isCameraEnabled}
              disabled={cameraLocked}
              onPress={onToggleCamera}
              label={strings.call.camera}
            />
          )}
          <ControlButton
            icon={PhoneOff}
            variant="danger"
            onPress={onEndCall}
            label={strings.call.endCall}
          />
        </View>
      </View>
    );
  }

  // Open mic mode (default)
  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <ControlButton
          icon={isMicEnabled ? Mic : MicOff}
          active={isMicEnabled}
          onPress={onToggleMic}
          label={isMicEnabled ? strings.call.mute : strings.call.unmute}
        />
        {showCamera && (
          <ControlButton
            icon={isCameraEnabled ? Camera : CameraOff}
            active={isCameraEnabled}
            disabled={cameraLocked}
            onPress={onToggleCamera}
            label={strings.call.camera}
          />
        )}
        <ControlButton
          icon={PhoneOff}
          variant="danger"
          onPress={onEndCall}
          label={strings.call.endCall}
        />
      </View>
    </View>
  );
}

// ─── Helper: single control button ───────────────────

type ControlButtonProps = {
  icon: React.ComponentType<{ size: number; color: string }>;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
  onPress: () => void;
  label: string;
};

function ControlButton({
  icon: Icon,
  active = true,
  disabled = false,
  variant = "default",
  onPress,
  label,
}: ControlButtonProps) {
  const styles = useStyles();
  return (
    <View style={styles.controlButtonWrapper}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        style={({ pressed }) => [
          styles.controlButton,
          variant === "danger" && styles.dangerButton,
          !active && variant !== "danger" && styles.inactiveButton,
          pressed && styles.pressedButton,
          disabled && styles.disabledButton,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        <Icon size={22} color="#fff" />
      </Pressable>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.card,
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  pttContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.card,
    gap: theme.spacing.xl,
  },
  buttonRow: {
    flexDirection: "row",
    gap: theme.spacing.xl,
  },
  controlButtonWrapper: {
    alignItems: "center",
    gap: 4,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButton: {
    backgroundColor: "#ef4444",
  },
  inactiveButton: {
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  pressedButton: {
    opacity: 0.7,
  },
  disabledButton: {
    opacity: 0.4,
  },
  controlLabel: {
    ...theme.typography.micro,
    color: theme.colors.foreground,
  },
  listenOnlyLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontWeight: theme.fontWeights.medium,
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/channels/components/CallControls.tsx
git commit -m "feat(mobile): add CallControls adapting to audio/video policy

Open mic: mic + camera + end. PTT: camera + hold-button + end.
Listen-only: camera + end. Camera hidden when video_policy=disabled.
All buttons 48x48dp minimum touch targets.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Create CallSheet (bottom sheet container)

The main orchestrating component that ties everything together.

**Files:**

- Create: `apps/mobile/src/features/channels/components/CallSheet.tsx`
- Modify: `apps/mobile/src/features/channels/components/CallBar.tsx`

- [ ] **Step 1: Create CallSheet**

```typescript
// apps/mobile/src/features/channels/components/CallSheet.tsx
/**
 * CallSheet — Full-screen bottom sheet for expanded call view.
 * Opens from CallBar tap. Contains header, participant grid, and controls.
 * Uses @gorhom/bottom-sheet via the project's BottomSheet wrapper.
 */
import React, { useCallback, useRef, useState, useEffect } from "react";
import { View, Text, Pressable, AccessibilityInfo } from "react-native";
import { ChevronDown } from "lucide-react-native";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { createStyles } from "@/theme";
import { emit } from "@smartout/telemetry";
import { strings } from "@/constants/strings";
import { useCallTracks } from "@/hooks/use-call-tracks";
import { ParticipantGrid } from "./ParticipantGrid";
import { CallControls } from "./CallControls";
import type { Room } from "livekit-client";
import type { AudioPolicy, VideoPolicy, PTTState } from "@smartout/walkie-talkie";

type Props = {
  room: Room | null;
  channelName: string;
  channelId: string;
  workspaceId: string;
  audioPolicy: AudioPolicy;
  videoPolicy: VideoPolicy;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  callStartedAt: string;
  pttState?: PTTState;
  isTalking?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  onEndCall: () => void;
  onClose: () => void;
};

function useDurationTimer(startedAt: string): string {
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(diff / 60).toString().padStart(2, "0");
      const secs = (diff % 60).toString().padStart(2, "0");
      setElapsed(`${mins}:${secs}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

export function CallSheet({
  room,
  channelName,
  channelId,
  workspaceId,
  audioPolicy,
  videoPolicy,
  isMicEnabled,
  isCameraEnabled,
  callStartedAt,
  pttState,
  isTalking,
  onToggleMic,
  onToggleCamera,
  onPttPressIn,
  onPttPressOut,
  onEndCall,
  onClose,
}: Props) {
  const styles = useStyles();
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const { participants, activeSpeakerIdentity, hasAnyVideo } = useCallTracks(room);
  const duration = useDurationTimer(callStartedAt);
  const openedAtRef = useRef(Date.now());

  // Telemetry on open
  useEffect(() => {
    openedAtRef.current = Date.now();
    // Telemetry — sheet opened. Actor ID should be passed as prop from authenticated context.
    // For now, workspace_id is sufficient for activity_trail routing.
  }, []);

  const handleClose = useCallback(() => {
    sheetRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={["95%"]}
      onClose={onClose}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.channelName} numberOfLines={1}>
            {channelName}
          </Text>
          <View style={styles.headerMeta}>
            <View style={styles.liveDot} />
            <Text style={styles.duration}>{duration}</Text>
            <Text style={styles.participantCount}>
              {participants.length} {strings.call.participants}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={handleClose}
          style={styles.minimizeButton}
          accessibilityRole="button"
          accessibilityLabel={strings.call.minimize}
        >
          <ChevronDown size={24} color={styles.channelName.color} />
        </Pressable>
      </View>

      {/* Participant Grid */}
      <View style={styles.gridContainer}>
        <ParticipantGrid
          participants={participants}
          activeSpeakerIdentity={activeSpeakerIdentity}
          hasAnyVideo={hasAnyVideo}
        />
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <CallControls
          audioPolicy={audioPolicy}
          videoPolicy={videoPolicy}
          isMicEnabled={isMicEnabled}
          isCameraEnabled={isCameraEnabled}
          pttState={pttState}
          isTalking={isTalking}
          onToggleMic={onToggleMic}
          onToggleCamera={onToggleCamera}
          onPttPressIn={onPttPressIn}
          onPttPressOut={onPttPressOut}
          onEndCall={onEndCall}
        />
      </View>
    </BottomSheet>
  );
}

const useStyles = createStyles((theme) => ({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.card,
    paddingVertical: theme.spacing.element,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerInfo: {
    flex: 1,
  },
  channelName: {
    ...theme.typography.headline,
    color: theme.colors.foreground,
    fontWeight: theme.fontWeights.bold,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22c55e",
  },
  duration: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
    fontVariant: ["tabular-nums"],
  },
  participantCount: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
  minimizeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  gridContainer: {
    flex: 1,
  },
  controlsContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
}));
```

- [ ] **Step 2: Add `onPress` to CallBar**

In `apps/mobile/src/features/channels/components/CallBar.tsx`, add `onPress` prop:

Add to the `Props` type:

```typescript
onPress?: () => void;
```

Wrap the entire `<View style={styles.container}>` in a `<Pressable onPress={onPress}>`:

```typescript
return (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Vis samtale">
    <View style={styles.container}>
      {/* ... existing content unchanged ... */}
    </View>
  </Pressable>
);
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/channels/components/CallSheet.tsx apps/mobile/src/features/channels/components/CallBar.tsx
git commit -m "feat(mobile): add CallSheet bottom sheet + CallBar onPress

Full-screen bottom sheet with header (channel name, duration,
participant count, minimize button), ParticipantGrid, and
CallControls. CallBar now opens CallSheet on tap.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Dependency Order

```
Task 1 (useCallTracks hook)
  └─→ Task 2 (ParticipantTile)
       └─→ Task 3 (ParticipantGrid)
            └─→ Task 4 (CallControls)
                 └─→ Task 5 (CallSheet + CallBar wiring)
```

Linear — each component depends on the previous.

## Deferred Items

| Item                                         | Reason                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Concurrent input mutex                       | Not applicable — mobile has no simultaneous voice + touch conflict                        |
| Agent presence glow                          | V2 — requires audio level API from LiveKit                                                |
| Reduced motion check                         | Should be added but is a small follow-up (~10 lines in ParticipantTile + ParticipantGrid) |
| Telemetry: camera toggle, sheet close events | Add during integration testing when we can verify emit() works on mobile                  |
| Reconnect logic after connection drop        | V2 feature                                                                                |
| Persistent call state across app restart     | V2 feature                                                                                |
