/**
 * CallControls — Bottom action bar for an active call.
 *
 * Renders three distinct layouts depending on the channel's audioPolicy:
 *   - open_mic   → mic toggle + optional camera toggle + end
 *   - ptt        → optional camera toggle + large PTT button + end
 *   - listen_only → static label + optional camera toggle + end
 *
 * Camera toggle visibility and enabled state are driven by videoPolicy:
 *   - "disabled"   → button hidden entirely
 *   - "required"   → button shown but disabled (camera is always on)
 *   - "optional" / "default_on" → fully interactive toggle
 *
 * All touch targets meet the 48dp minimum required by the design system.
 */
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Mic, MicOff, Camera, CameraOff, PhoneOff } from "lucide-react-native";
import { createStyles } from "@/theme";
import { strings } from "@/constants/strings";
import { PTTButton } from "./PTTButton";
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

  const showCameraButton = videoPolicy !== "disabled";
  const cameraDisabled = videoPolicy === "required";

  return (
    <View style={styles.container}>
      {/* Left slot — mic toggle (open_mic) or listen-only label */}
      {audioPolicy === "open_mic" && (
        <ControlButton
          onPress={onToggleMic}
          label={isMicEnabled ? strings.call.mute : strings.call.unmute}
          icon={isMicEnabled ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#fff" />}
          variant={isMicEnabled ? "default" : "muted"}
          styles={styles}
        />
      )}

      {audioPolicy === "listen_only" && (
        <View style={styles.listenOnlyBadge}>
          <Text style={styles.listenOnlyText}>{strings.call.listenOnly}</Text>
        </View>
      )}

      {/* Camera toggle — hidden when videoPolicy is "disabled" */}
      {showCameraButton && (
        <ControlButton
          onPress={onToggleCamera}
          label={strings.call.camera}
          icon={
            isCameraEnabled ? (
              <Camera size={22} color="#fff" />
            ) : (
              <CameraOff size={22} color="#fff" />
            )
          }
          variant={isCameraEnabled ? "default" : "muted"}
          disabled={cameraDisabled}
          styles={styles}
        />
      )}

      {/* Centre slot — PTT button when in push-to-talk mode */}
      {audioPolicy === "ptt" && onPttPressIn && onPttPressOut && (
        <PTTButton
          pttState={pttState}
          isTalking={isTalking}
          onPressIn={onPttPressIn}
          onPressOut={onPttPressOut}
        />
      )}

      {/* End call — always present, always destructive red */}
      <ControlButton
        onPress={onEndCall}
        label={strings.call.endCall}
        icon={<PhoneOff size={22} color="#fff" />}
        variant="danger"
        styles={styles}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Internal helper — a single labelled icon button
// ---------------------------------------------------------------------------

type ControlButtonVariant = "default" | "muted" | "danger";

type ControlButtonProps = {
  onPress: () => void;
  label: string;
  icon: React.ReactNode;
  variant: ControlButtonVariant;
  disabled?: boolean;
  styles: ReturnType<typeof useStyles>;
};

function ControlButton({
  onPress,
  label,
  icon,
  variant,
  disabled = false,
  styles,
}: ControlButtonProps) {
  return (
    <View style={styles.buttonWrapper}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          variant === "muted" && styles.buttonMuted,
          variant === "danger" && styles.buttonDanger,
          pressed && !disabled && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
      >
        {icon}
      </Pressable>
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = createStyles((theme) => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.tight,
  },

  // Individual button wrapper keeps icon + label together
  buttonWrapper: {
    alignItems: "center",
    gap: theme.spacing.xs,
  },

  // 48dp minimum touch target
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonMuted: {
    backgroundColor: theme.colors.border,
  },
  buttonDanger: {
    backgroundColor: "#ef4444",
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  buttonLabel: {
    ...theme.typography.caption,
    color: theme.colors.foreground,
  },
  buttonLabelDisabled: {
    color: theme.colors.mutedForeground,
  },

  // Listen-only badge shown in the left slot
  listenOnlyBadge: {
    paddingHorizontal: theme.spacing.tight,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.muted,
  },
  listenOnlyText: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
