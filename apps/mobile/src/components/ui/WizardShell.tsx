/**
 * Mobile WizardShell — RN twin of the web WizardShell.
 *
 * Uses the shared `useWizardState` via deep import
 * (`@smartout/ui/wizard/state`, per ADR-0397 + T5 ESLint rule) so
 * step-navigation, validation, and `onComplete` behaviour are
 * identical on both platforms.
 *
 * WizardHeader (T18) is mounted here — the shell owns the header;
 * individual steps never render their own. FadeIn/FadeOut for the
 * step body is gated on `useReducedMotion()` from react-native-reanimated
 * (v4+). accessibilityLiveRegion="polite" on the animated wrapper
 * ensures VoiceOver / TalkBack announces step changes.
 *
 * Step components receive the full `WizardStepProps<TState>` shape.
 * Three props that exist only on the web surface are stubbed:
 *   - `attempted` — mobile steps rely on reanimated feedback; kept as
 *     false because the mobile nav-bar approach is distinct.
 *   - `t`         — identity pass-through; mobile i18n threading is a
 *     separate sortie. Stubs are typed to keep cross-platform types
 *     sound while the i18n layer ships.
 *   - `botsson`   — no-op stub; Botsson semantic tagging is web-only
 *     in V1 (data-botsson-* attributes have no RN equivalent).
 */

import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { MoreVertical } from "lucide-react-native";
import {
  useWizardState,
  type WizardDefinition,
  type WizardStepProps,
} from "@smartout/ui/wizard/state";
import { createStyles, useTheme } from "@/theme";
import { WizardHeader } from "@/components/ui/WizardHeader";
import { nativeMotion } from "@smartout/design-tokens/native";

// ─── Props ────────────────────────────────────────────────────────────────────

export type WizardShellProps<TState extends Record<string, unknown>> = {
  /** Wizard definition — steps, initialState, onComplete, etc. */
  definition: WizardDefinition<TState>;
  /** Department name shown in the WizardHeader label row. */
  departmentName: string;
  /** Called when the user taps "Lukk og fortsett senere". */
  onDismiss?: () => void;
};

// ─── Mobile-only stubs for web-surface props ──────────────────────────────────

/** Identity i18n stub — replaced when mobile i18n threading ships. */
function stubT(key: string): string {
  return key;
}

/** No-op Botsson helper — data-botsson-* attributes are web-only in V1. */
const stubBotsson: WizardStepProps<Record<string, unknown>>["botsson"] = {
  id: (element) => element,
  tag: (element, intent, context) => ({
    "data-botsson-id": element,
    "data-botsson-intent": intent,
    "data-botsson-type": "wizard",
    ...(context ? { "data-botsson-context": JSON.stringify(context) } : {}),
  }),
};

// ─── Shell ────────────────────────────────────────────────────────────────────

export function WizardShell<TState extends Record<string, unknown>>({
  definition,
  departmentName,
  onDismiss,
}: WizardShellProps<TState>) {
  const theme = useTheme();
  const styles = useStyles();
  const reduced = useReducedMotion();

  const wizard = useWizardState<TState>(definition);

  const stepDef = wizard.currentStep;
  const Step = stepDef?.component as React.ComponentType<WizardStepProps<TState>> | undefined;

  // `useWizardState.next` returns Promise<{success, errors}> for validation
  // feedback, but WizardStepProps.next is typed as () => void | Promise<void>.
  // Mobile step components don't consume the result object (validation errors
  // surface via inline field state, not shell-level feedback in V1), so we
  // wrap to discard the return value and satisfy the stricter prop type.
  const handleNext = React.useCallback((): Promise<void> => {
    return wizard.next().then(() => undefined);
  }, [wizard]);

  // Compose the full WizardStepProps for the current step.
  const stepProps: WizardStepProps<TState> = {
    state: wizard.data,
    updateState: wizard.updateState,
    next: handleNext,
    back: wizard.back,
    goTo: wizard.goTo,
    isFirst: wizard.isFirst,
    isLast: wizard.isLast,
    // `attempted` is mobile-unused in V1 — see file header.
    attempted: false,
    t: stubT,
    theme: { name: definition.theme },
    botsson: stubBotsson as WizardStepProps<TState>["botsson"],
  };

  return (
    <SafeAreaView style={styles.root}>
      <WizardHeader
        departmentName={departmentName}
        currentStep={wizard.currentStepIndex}
        totalSteps={wizard.totalSteps}
        onClose={onDismiss ?? (() => undefined)}
        reducedMotion={reduced ?? false}
      />

      {/* Step body — keyed by step index so Reanimated mounts a fresh
          Animated.View for every step transition. accessibilityLiveRegion
          tells assistive tech to announce the new step content. */}
      <Animated.View
        key={wizard.currentStepIndex}
        entering={reduced ? undefined : FadeIn.duration(nativeMotion.enterMs)}
        exiting={reduced ? undefined : FadeOut.duration(nativeMotion.exitMs)}
        style={styles.body}
        accessibilityLiveRegion="polite"
      >
        {Step != null ? <Step {...stepProps} /> : null}
      </Animated.View>

      {onDismiss != null && (
        <Pressable
          onPress={onDismiss}
          style={styles.dismiss}
          accessibilityRole="button"
          accessibilityLabel="Lukk og fortsett senere"
        >
          <MoreVertical size={20} color={theme.colors.mutedForeground} />
          <Text style={styles.dismissLabel}>Lukk og fortsett senere</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = createStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.element,
  },
  dismiss: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: theme.spacing.element,
    paddingHorizontal: theme.spacing.element,
  },
  dismissLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedForeground,
  },
}));
