/**
 * ChannelMessageBubble — Visual alias of chat/MessageBubble for the channel
 * schema (`ChannelMessageWithSender`).
 *
 * Prototype parity: docs/design/smartout-design-helpdesk/project/prototype/chat-screens.jsx:383-447
 *
 * Variants:
 *   own     — right-aligned, `colors.warnSoft` surface (warm cream, WhatsApp own-bubble feel),
 *             corners 16/16/4/16, `colors.foreground` text, time + ReadReceipt inline bottom-right.
 *   other   — left-aligned with 32pt avatar, `colors.muted` surface,
 *             corners 16/16/16/4, sender name micro-label above the bubble.
 *   system  — centered pill with italic muted text (bg-muted + border).
 *
 * ADR-0165: shared visual primitive with chat/MessageBubble; this file exists
 * solely to adapt the channel message type while emitting identical styles.
 *
 * Swipe-to-reply (Phase 2 T1):
 *   Mirrors MessageBubble gesture pattern exactly.
 *   Horizontal pan (Gesture.Pan + activeOffsetX) → translateX shared value.
 *   Threshold 48px → haptic + onSwipeReply (once per gesture).
 *   Spring back via motion.springSnappy from @smartout/design-tokens.
 *   CornerUpLeft reply icon fades in behind bubble, opposite side to drag.
 *
 * Long-press scale-spring (Phase 2 T3):
 *   Mirrors MessageBubble T3 pattern exactly.
 *   Gesture.LongPress() composed with pan via Gesture.Simultaneous.
 *   On long-press start: scale 1.0 → 1.05 via springSnappy.
 *   On finalize: scale returns to 1.0 via springSnappy.
 *   onLongPress callback fires from Pressable (haptic + ReactionBar) — not duplicated in gesture.
 */
import React, { useCallback, useEffect, useRef } from "react";
import { View, Text, Pressable, Platform, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { CornerUpLeft } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { nativeTheme } from "@smartout/design-tokens/native";
import { createStyles, useTheme } from "@/theme";
import { Avatar } from "@/components/common/Avatar";
import type { ChannelMessageWithSender } from "@/hooks/queries/use-channel-messages";
import { ReadReceipt, type ReadReceiptState } from "@/components/chat/ReadReceipt";
import { TierBadge } from "@/components/news/TierBadge";
import { EntityLinkCTA } from "@/components/news/EntityLinkCTA";

// ─── Swipe constants — pulled from token scope, no magic numbers elsewhere ───
const SWIPE_MAX = 64; // max translateX (px)
const SWIPE_THRESHOLD = 48; // px to trigger reply
const { springSnappy } = nativeTheme.motion;

const SYSTEM_TYPES = new Set(["system", "brief", "handoff", "announcement", "reminder", "summary"]);

type Props = {
  message: ChannelMessageWithSender & { _isPending?: boolean };
  isOwnMessage: boolean;
  onLongPress: () => void;
  onSwipeReply: () => void;
  readReceiptState?: ReadReceiptState;
  style?: ViewStyle;
};

const MONO_FAMILY = Platform.select({
  ios: "Menlo",
  android: "monospace",
  default: "monospace",
});

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

/**
 * ChannelMessageBubbleInner — internal implementation wrapped in React.memo below.
 * Gesture state lives in shared values — no React re-render during swipe.
 */
function ChannelMessageBubbleInner({
  message,
  isOwnMessage,
  onLongPress,
  onSwipeReply,
  readReceiptState: receiptProp,
  style,
}: Props) {
  const styles = useStyles();
  const theme = useTheme();

  // ── Swipe shared values (gesture thread — never trigger React render) ──────
  const translateX = useSharedValue(0);
  // Boolean shared value: 1 = fired this gesture, 0 = not fired yet.
  const hasFired = useSharedValue(0);
  // isOwnMessage as shared value — avoids closing over the JS prop in the worklet,
  // which would force the native gesture recognizer to tear down and rebuild every
  // render (since the worklet captures a new closure reference each time).
  const isOwnSV = useSharedValue(isOwnMessage ? 1 : 0);
  useEffect(() => {
    isOwnSV.value = isOwnMessage ? 1 : 0;
  }, [isOwnMessage, isOwnSV]);

  // ── Long-press scale shared value (gesture thread — never triggers React render) ──
  const scale = useSharedValue(1);

  // JS-thread callback — haptic + show ReactionBar. Called from Pressable onLongPress.
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  }, [onLongPress]);

  // Stable ref so the worklet closure captures a stable identity.
  const onSwipeReplyRef = useRef(onSwipeReply);
  onSwipeReplyRef.current = onSwipeReply;

  // Wrapper called from gesture worklet via runOnJS.
  const fireReply = useCallback(() => {
    Haptics.selectionAsync();
    onSwipeReplyRef.current();
  }, []);

  /**
   * Long-press gesture (T3) — drives scale spring only.
   * `minDuration` 300ms matches Pressable `delayLongPress` so scale animates in sync.
   * onLongPress callback fires via Pressable — not duplicated here to avoid double-fire.
   */
  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      "worklet";
      scale.value = withSpring(1.05, springSnappy);
    })
    .onFinalize(() => {
      "worklet";
      // Reset scale on release or cancel.
      scale.value = withSpring(1, springSnappy);
    });

  /**
   * Pan gesture — horizontal-only (activeOffsetX guards FlatList scroll).
   * Direction: own messages drag right (+X), other messages drag left (-X).
   * Wrong-direction drag is clamped to 0 so no translate occurs.
   */
  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      "worklet";
      const raw = e.translationX;
      // Direction gate: own → positive X only, other → negative X only.
      // Use isOwnSV (shared value) instead of closing over the JS prop so the
      // native gesture recognizer is not rebuilt on every render.
      const directedRaw = isOwnSV.value === 1 ? Math.max(0, raw) : Math.min(0, raw);
      // Clamp to max travel distance (absolute value bounded by SWIPE_MAX).
      const clamped =
        isOwnSV.value === 1 ? Math.min(directedRaw, SWIPE_MAX) : Math.max(directedRaw, -SWIPE_MAX);
      translateX.value = clamped;

      // Fire reply once when threshold crossed.
      const absTravel = Math.abs(clamped);
      if (absTravel >= SWIPE_THRESHOLD && hasFired.value === 0) {
        hasFired.value = 1;
        runOnJS(fireReply)();
      }
    })
    .onEnd(() => {
      "worklet";
      translateX.value = withSpring(0, springSnappy);
      hasFired.value = 0;
    });

  /**
   * Compose pan + long-press simultaneously so both gestures can recognize
   * without one cancelling the other (long-press is stationary, pan is horizontal).
   */
  const composedGesture = Gesture.Simultaneous(panGesture, longPressGesture);

  // ── Animated styles ───────────────────────────────────────────────────────
  const bubbleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  /**
   * Reply icon fades in proportionally to drag distance.
   * Positioned on the OPPOSITE side from drag direction:
   *   own (drags right) → icon left of bubble
   *   other (drags left) → icon right of bubble
   */
  const replyIconAnimStyle = useAnimatedStyle(() => {
    const absTravel = Math.abs(translateX.value);
    const opacity = interpolate(absTravel, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return { opacity };
  });

  // Derive effective receipt state: pending flag takes precedence over prop.
  const effectiveReceiptState: ReadReceiptState = message._isPending
    ? "pending"
    : (receiptProp ?? "sent");

  // Deleted / system → centered italic pill.
  if (message.deleted_at) {
    return (
      <View style={[styles.systemContainer, style]}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>Melding slettet</Text>
        </View>
      </View>
    );
  }

  if (SYSTEM_TYPES.has(message.message_type)) {
    return (
      <View style={[styles.systemContainer, style]}>
        <View style={styles.systemPill}>
          <Text style={styles.systemText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  // Group reactions by emoji.
  const groupedReactions = message.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
    return acc;
  }, {});

  const bubbleTextColor = theme.colors.foreground;
  const bubbleCorners = isOwnMessage
    ? {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 4,
        borderBottomLeftRadius: 16,
      }
    : {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomRightRadius: 16,
        borderBottomLeftRadius: 4,
      };

  // Own bubble uses warnSoft (warm cream) for WhatsApp-style visual separation.
  // secondary === muted in both light/dark, making own+other indistinguishable — T8 fix.
  const bubbleBg = isOwnMessage ? theme.colors.warnSoft : theme.colors.muted;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther, style]}>
        {/* Reply icon — shown on the side opposite to drag direction */}
        {isOwnMessage ? (
          // Own: drags right → icon on LEFT of bubble row
          <Animated.View style={[styles.replyIcon, styles.replyIconLeft, replyIconAnimStyle]}>
            <CornerUpLeft size={20} color={theme.colors.mutedForeground} />
          </Animated.View>
        ) : (
          // Other: drags left → icon on RIGHT of bubble row
          <Animated.View style={[styles.replyIcon, styles.replyIconRight, replyIconAnimStyle]}>
            <CornerUpLeft size={20} color={theme.colors.mutedForeground} />
          </Animated.View>
        )}

        {!isOwnMessage && (
          <View style={styles.avatarSlot}>
            <Avatar
              name={message.sender_name ?? "?"}
              imageUrl={message.sender_avatar}
              size="sm"
              style={styles.avatar}
            />
          </View>
        )}

        <Animated.View style={[styles.column, isOwnMessage && styles.columnOwn, bubbleAnimStyle]}>
          {!isOwnMessage && message.sender_name && (
            <Text style={styles.senderName}>{message.sender_name}</Text>
          )}

          <Pressable
            onLongPress={handleLongPress}
            delayLongPress={300}
            accessibilityLabel={`${message.sender_name}: ${message.content}`}
          >
            <View style={[styles.bubble, bubbleCorners, { backgroundColor: bubbleBg }]}>
              {message.reply_to_id && message.reply_to_content && (
                <View style={isOwnMessage ? styles.replyIndicatorOwn : styles.replyIndicator}>
                  <Text
                    style={[styles.replyLabel, isOwnMessage && styles.replyLabelOwn]}
                    numberOfLines={1}
                  >
                    {message.reply_to_sender_name ?? ""}
                  </Text>
                  <Text
                    style={[styles.replyText, isOwnMessage && styles.replyTextOwn]}
                    numberOfLines={1}
                  >
                    {message.reply_to_content}
                  </Text>
                </View>
              )}
              <Text style={[styles.content, { color: bubbleTextColor }]}>{message.content}</Text>

              {/* Inline meta: time + receipt (own) / time only (other) — bottom-right */}
              <View style={styles.inlineMeta}>
                <Text style={styles.inlineTimestamp}>{formatTime(message.created_at)}</Text>
                {isOwnMessage && <ReadReceipt state={effectiveReceiptState} size={11} />}
              </View>

              {/* Announcement V2: tier badge + entity link CTA (below inlineMeta) */}
              {message.announcement_tier && <TierBadge tier={message.announcement_tier} />}
              {message.announcement_link_type && message.announcement_link_id && (
                <EntityLinkCTA
                  messageId={message.message_id}
                  announcementKind={message.announcement_kind ?? "general"}
                  linkType={message.announcement_link_type}
                  linkId={message.announcement_link_id}
                />
              )}
            </View>
          </Pressable>

          {Object.keys(groupedReactions).length > 0 && (
            <View
              style={[
                styles.reactionsRow,
                isOwnMessage ? styles.reactionsRowOwn : styles.reactionsRowOther,
              ]}
            >
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <View key={emoji} style={styles.reactionPill}>
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                  <Text style={styles.reactionCount}>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * ChannelMessageBubble — memoized to prevent re-render during gesture.
 * Re-renders only when content, receipt state, or reaction count changes.
 */
export const ChannelMessageBubble = React.memo(ChannelMessageBubbleInner, (prev, next) => {
  return (
    prev.message.message_id === next.message.message_id &&
    prev.message.content === next.message.content &&
    prev.readReceiptState === next.readReceiptState &&
    prev.message._isPending === next.message._isPending &&
    prev.isOwnMessage === next.isOwnMessage &&
    prev.message.reactions.length === next.message.reactions.length
  );
});

const useStyles = createStyles((theme) => ({
  row: {
    marginVertical: 3,
    maxWidth: "80%",
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
  },
  rowOwn: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  rowOther: {
    alignSelf: "flex-start",
  },
  avatarSlot: {
    paddingBottom: 2,
  },
  avatar: {
    borderRadius: theme.radius.full,
  },
  column: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  columnOwn: {
    alignItems: "flex-end",
  },
  senderName: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.colors.mutedForeground,
    marginBottom: 2,
    paddingLeft: 2,
  },
  bubble: {
    paddingHorizontal: 13,
    paddingTop: 8,
    paddingBottom: 6,
  },
  content: {
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: 4,
  },

  /* Inline meta row — time + receipt bottom-right inside bubble */
  inlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
  },
  inlineTimestamp: {
    fontFamily: MONO_FAMILY,
    fontSize: 9.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: theme.colors.mutedForeground,
  },

  /* Reply indicators */
  replyIndicator: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.brandOrange,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyIndicatorOwn: {
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: theme.colors.brandOrange,
  },
  replyLabelOwn: {
    color: theme.colors.mutedForeground,
  },
  replyText: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
  },
  replyTextOwn: {
    color: theme.colors.mutedForeground,
  },

  /* Reply icon — rendered behind the bubble during swipe */
  replyIcon: {
    position: "absolute",
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 32,
  },
  replyIconLeft: {
    left: -36,
  },
  replyIconRight: {
    right: -36,
  },

  /* Reactions */
  reactionsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 3,
  },
  reactionsRowOwn: {
    paddingRight: 2,
    alignSelf: "flex-end",
  },
  reactionsRowOther: {
    paddingLeft: 2,
    alignSelf: "flex-start",
  },
  reactionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reactionEmoji: {
    fontSize: 11.5,
  },
  reactionCount: {
    fontFamily: MONO_FAMILY,
    fontSize: 10,
    color: theme.colors.mutedForeground,
  },

  /* System */
  systemContainer: {
    alignSelf: "center",
    marginVertical: 8,
  },
  systemPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  systemText: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: theme.colors.mutedForeground,
  },
}));
