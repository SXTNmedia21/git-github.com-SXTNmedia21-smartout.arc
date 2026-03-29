/**
 * FlowPlayer — Immersive training module player.
 *
 * 4-phase flow:
 * 1. Hero — module intro + "Start modulen"
 * 2. Manual — step-by-step with image, instruction, tips, prev/next
 * 3. Quiz — rich choice cards with progress bar
 * 4. Complete — score ring + stats
 */

import React, { useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import {
  ChevronLeft,
  Play,
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Star,
  Timer,
  Trophy,
  Check,
  Send,
} from "lucide-react-native";
import { createStyles, useTheme, withOpacity } from "@/theme";

type Phase = "hero" | "manual" | "quiz" | "complete";

// ── Manual steps data ──

type ManualStep = {
  number: string;
  title: string;
  instruction: string;
  tip: string;
};

const MANUAL_STEPS: ManualStep[] = [
  {
    number: "01",
    title: "Plassering av asjetten",
    instruction:
      "Plasser den flate hovedtallerkenen midt foran hver stol, ca. to centimeter fra bordkanten. Sørg for at den ligger parallelt med kanten for et symmetrisk uttrykk.",
    tip: "Bruk to fingre for å måle avstand",
  },
  {
    number: "02",
    title: "Bestikk og rekkefølge",
    instruction:
      "Legg gafler til venstre og kniver/skjeer til høyre for tallerkenen. Bladet peker innover. Bestikk plasseres i rekkefølge utenfra og inn etter rettens gang.",
    tip: "Teller utenfra: forrett → hovedrett",
  },
  {
    number: "03",
    title: "Glass og servietter",
    instruction:
      "Vannglass plasseres over knivspissen. Vinglass til høyre for vannglasset. Servietten brettes enkelt og legges på tallerkenen eller til venstre for gaflene.",
    tip: "Fold servietten i en enkel rektangel for nordisk stil",
  },
];

// ── Quiz data ──

type QuizChoice = { id: string; label: string; title: string; subtitle: string };

const QUIZ_CHOICES: QuizChoice[] = [
  {
    id: "a",
    label: "Alternativ A",
    title: "Strukturert Stillhet",
    subtitle: "Organiserte omgivelser og dyp konsentrasjon.",
  },
  {
    id: "b",
    label: "Alternativ B",
    title: "Spontan Energi",
    subtitle: "Åpenhet for nye inntrykk og raske skifter.",
  },
  {
    id: "c",
    label: "Alternativ C",
    title: "Sosial Resonans",
    subtitle: "Samhandling og utveksling av ideer med andre.",
  },
  {
    id: "d",
    label: "Alternativ D",
    title: "Naturlig Rytme",
    subtitle: "Følge kroppens behov og naturlige dagslys.",
  },
];

const CIRCUMFERENCE = 2 * Math.PI * 100;

export default function FlowPlayerScreen() {
  const styles = useStyles();
  const theme = useTheme();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("hero");
  const [stepIndex, setStepIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);

  const currentStep = MANUAL_STEPS[stepIndex];
  const totalSteps = MANUAL_STEPS.length;

  const handleStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("manual");
  };

  const handleNextStep = () => {
    Haptics.selectionAsync();
    if (stepIndex < totalSteps - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      setPhase("quiz");
    }
  };

  const handlePrevStep = () => {
    Haptics.selectionAsync();
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleSubmitQuiz = () => {
    if (!quizAnswer) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("complete");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={12}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={theme.colors.foreground} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.headerTitle}>FlowPlayer</Text>
        <View style={styles.moduleBadge}>
          <Text style={styles.moduleBadgeText}>
            {phase === "manual"
              ? `MANUAL: BORDDEKKING`
              : phase === "quiz"
                ? "QUIZ"
                : "KURSMODUL 04"}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ══ HERO ══ */}
        {phase === "hero" && (
          <Animated.View entering={FadeIn.delay(50).duration(500)} style={styles.hero}>
            <Text style={styles.heroTitle}>
              Velkommen til{"\n"}
              <Text style={styles.heroAccent}>Opplæring</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Mestre kunsten av gjestfrihet gjennom vårt ambient læringssystem. Start din reise her.
            </Text>
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>Start modulen</Text>
            </Pressable>
          </Animated.View>
        )}

        {/* ══ MANUAL STEP ══ */}
        {phase === "manual" && currentStep && (
          <Animated.View entering={FadeIn.delay(50).duration(400)} key={stepIndex}>
            {/* Progress */}
            <View style={styles.stepMeta}>
              <Text style={styles.stepLabel}>
                STEG {stepIndex + 1} AV {totalSteps}
              </Text>
              <View style={styles.stepDots}>
                {MANUAL_STEPS.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      i <= stepIndex ? styles.stepDotActive : styles.stepDotInactive,
                      i === stepIndex && styles.stepDotCurrent,
                    ]}
                  />
                ))}
              </View>
            </View>

            <Text style={styles.manualTitle}>{currentStep.title}</Text>

            {/* Image placeholder */}
            <View style={styles.manualImage}>
              <Play
                size={32}
                color={withOpacity(theme.colors.mutedForeground, 0.3)}
                strokeWidth={1}
              />
            </View>

            {/* Instruction */}
            <View style={styles.instructionCard}>
              <Text style={styles.instructionText}>{currentStep.instruction}</Text>
              <View style={styles.tipRow}>
                <Lightbulb size={14} color={theme.colors.brandOrange} strokeWidth={1.5} />
                <Text style={styles.tipText}>TIPS: {currentStep.tip}</Text>
              </View>
            </View>

            {/* Prev / Next */}
            <View style={styles.navRow}>
              <Pressable
                onPress={handlePrevStep}
                disabled={stepIndex === 0}
                style={({ pressed }) => [
                  styles.navButton,
                  styles.navButtonSecondary,
                  stepIndex === 0 && styles.navButtonDisabled,
                  pressed && styles.ctaPressed,
                ]}
              >
                <ArrowLeft
                  size={18}
                  color={
                    stepIndex === 0
                      ? withOpacity(theme.colors.mutedForeground, 0.3)
                      : theme.colors.mutedForeground
                  }
                  strokeWidth={2}
                />
                <Text
                  style={[styles.navButtonText, stepIndex === 0 && styles.navButtonTextDisabled]}
                >
                  Forrige
                </Text>
              </Pressable>
              <Pressable
                onPress={handleNextStep}
                style={({ pressed }) => [
                  styles.navButton,
                  styles.navButtonPrimary,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.navButtonTextPrimary}>
                  {stepIndex < totalSteps - 1 ? "Neste steg" : "Til quiz"}
                </Text>
                <ArrowRight size={18} color="#ffffff" strokeWidth={2} />
              </Pressable>
            </View>

            {/* Upcoming steps preview */}
            {stepIndex < totalSteps - 1 && (
              <View style={styles.previewSection}>
                <Text style={styles.previewLabel}>NESTE STEG I PROSESSEN</Text>
                {MANUAL_STEPS.slice(stepIndex + 1).map((s) => (
                  <View key={s.number} style={styles.previewRow}>
                    <View style={styles.previewNumber}>
                      <Text style={styles.previewNumberText}>{s.number}</Text>
                    </View>
                    <Text style={styles.previewTitle}>{s.title}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ══ QUIZ ══ */}
        {phase === "quiz" && (
          <Animated.View entering={FadeIn.delay(50).duration(400)}>
            {/* Progress bar */}
            <View style={styles.quizProgress}>
              <Text style={styles.quizProgressLabel}>MODULE 04 · QUIZ</Text>
              <Text style={styles.quizProgressPercent}>75% COMPLETE</Text>
            </View>
            <View style={styles.quizProgressTrack}>
              <View style={styles.quizProgressFill} />
            </View>

            {/* Question */}
            <Text style={styles.quizTitle}>Hva inspirerer ditt daglige fokus?</Text>
            <Text style={styles.quizSubtitle}>
              Velg det alternativet som best beskriver din tilnærming til kreativ flyt i dag.
            </Text>

            {/* Choice cards */}
            <View style={styles.choiceList}>
              {QUIZ_CHOICES.map((choice, i) => {
                const isSelected = quizAnswer === choice.id;
                return (
                  <Animated.View
                    key={choice.id}
                    entering={FadeInDown.delay(100 + i * 60)
                      .duration(400)
                      .springify()}
                  >
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        setQuizAnswer(choice.id);
                      }}
                      style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}
                    >
                      <View style={styles.choiceContent}>
                        <Text
                          style={[styles.choiceLabel, isSelected && styles.choiceLabelSelected]}
                        >
                          {choice.label}
                        </Text>
                        <Text style={styles.choiceTitle}>{choice.title}</Text>
                        <Text style={styles.choiceSubtitle}>{choice.subtitle}</Text>
                      </View>
                      <View style={[styles.choiceRadio, isSelected && styles.choiceRadioSelected]}>
                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ══ COMPLETE ══ */}
        {phase === "complete" && (
          <Animated.View entering={FadeIn.delay(100).duration(600)} style={styles.completeSection}>
            <View style={styles.ringContainer}>
              <View style={{ transform: [{ rotate: "-90deg" }] }}>
                <Svg width={200} height={200} viewBox="0 0 220 220">
                  <SvgCircle
                    cx={110}
                    cy={110}
                    r={100}
                    fill="transparent"
                    stroke={theme.colors.muted}
                    strokeWidth={8}
                  />
                  <SvgCircle
                    cx={110}
                    cy={110}
                    r={100}
                    fill="transparent"
                    stroke={theme.colors.brandOrange}
                    strokeWidth={12}
                    strokeLinecap="round"
                    strokeDasharray={`${CIRCUMFERENCE}`}
                    strokeDashoffset={0}
                  />
                </Svg>
              </View>
              <View style={styles.ringCenter}>
                <Text style={styles.ringPercent}>100%</Text>
                <Text style={styles.ringLabel}>FULLFØRT</Text>
              </View>
            </View>
            <Text style={styles.completeTitle}>Fantastisk innsats!</Text>
            <View style={styles.scoreList}>
              {[
                { icon: Star, label: "Oppnådde poeng", value: "850 / 850" },
                { icon: Timer, label: "Tid brukt", value: "14:22" },
                { icon: Trophy, label: "Nye merker", value: "Sikkerhetsmester" },
              ].map((row) => (
                <View key={row.label} style={styles.scoreRow}>
                  <row.icon size={20} color={theme.colors.brandOrange} strokeWidth={1.5} />
                  <Text style={styles.scoreLabel}>{row.label}</Text>
                  <Text style={styles.scoreValue}>{row.value}</Text>
                </View>
              ))}
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaText}>Tilbake til opplæring</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      {/* Quiz fixed CTA */}
      {phase === "quiz" && quizAnswer && (
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.quizCta}>
          <Pressable
            onPress={handleSubmitQuiz}
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaText}>Send svar</Text>
            <Send size={18} color="#ffffff" strokeWidth={2} />
          </Pressable>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.element,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    fontSize: 22,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.brandOrange,
  },
  moduleBadge: {
    backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  moduleBadgeText: {
    fontSize: 9,
    fontWeight: "500",
    letterSpacing: 1,
    color: theme.colors.mutedForeground,
  },
  scrollContent: { paddingHorizontal: theme.spacing.section, paddingBottom: 120 },

  /* Shared CTA */
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.element,
    backgroundColor: theme.colors.brandOrange,
    paddingVertical: 18,
    borderRadius: theme.radius.full,
    ...theme.shadows.lg,
  },
  ctaPressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  ctaText: { fontSize: 16, fontWeight: "600", color: "#ffffff" },

  /* Hero */
  hero: { alignItems: "center", paddingVertical: theme.spacing.xl * 2, gap: theme.spacing.section },
  heroTitle: {
    fontSize: 40,
    fontWeight: "300",
    letterSpacing: -1,
    color: theme.colors.foreground,
    textAlign: "center",
    lineHeight: 46,
  },
  heroAccent: { fontStyle: "italic", color: theme.colors.brandOrange },
  heroSubtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: theme.spacing.md,
  },

  /* Manual */
  stepMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.element,
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: theme.colors.brandOrange,
    textTransform: "uppercase",
  },
  stepDots: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepDot: { height: 4, borderRadius: 2 },
  stepDotActive: { width: 32, backgroundColor: theme.colors.brandOrange },
  stepDotInactive: { width: 8, backgroundColor: withOpacity(theme.colors.muted, 0.5) },
  stepDotCurrent: { width: 12, height: 6, borderRadius: 3 },
  manualTitle: {
    fontSize: 32,
    fontWeight: "300",
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    lineHeight: 38,
    marginBottom: theme.spacing.page,
  },
  manualImage: {
    aspectRatio: 4 / 5,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.page,
    ...theme.shadows.lg,
  },
  instructionCard: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.section,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.page,
  },
  instructionText: { fontSize: 18, lineHeight: 28, color: theme.colors.mutedForeground },
  tipRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: theme.spacing.element },
  tipText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: theme.colors.brandOrange },

  navRow: { flexDirection: "row", gap: theme.spacing.md },
  navButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: theme.radius.lg,
  },
  navButtonSecondary: {
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.muted,
  },
  navButtonPrimary: { backgroundColor: theme.colors.brandOrange, ...theme.shadows.md },
  navButtonDisabled: { opacity: 0.4 },
  navButtonText: { ...theme.typography.bodyBold, color: theme.colors.mutedForeground },
  navButtonTextDisabled: { color: withOpacity(theme.colors.mutedForeground, 0.3) },
  navButtonTextPrimary: { ...theme.typography.bodyBold, color: "#ffffff" },

  previewSection: { marginTop: theme.spacing.xl, opacity: 0.4, gap: theme.spacing.element },
  previewLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.lg,
  },
  previewNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.muted, 0.5) : theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  previewNumberText: { fontSize: 12, fontWeight: "500", color: theme.colors.mutedForeground },
  previewTitle: { ...theme.typography.body, fontWeight: "500", color: theme.colors.foreground },

  /* Quiz */
  quizProgress: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  quizProgressLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1,
    color: withOpacity(theme.colors.mutedForeground, 0.6),
  },
  quizProgressPercent: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: theme.colors.brandOrange,
  },
  quizProgressTrack: {
    height: 6,
    backgroundColor: theme.colors.muted,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: theme.spacing.page,
  },
  quizProgressFill: {
    height: "100%",
    width: "75%",
    backgroundColor: theme.colors.brandOrange,
    borderRadius: 3,
  },
  quizTitle: {
    fontSize: 32,
    fontWeight: "300",
    letterSpacing: -0.5,
    lineHeight: 38,
    color: theme.colors.foreground,
    marginBottom: theme.spacing.md,
  },
  quizSubtitle: {
    ...theme.typography.body,
    color: theme.colors.mutedForeground,
    lineHeight: 22,
    marginBottom: theme.spacing.page,
  },
  choiceList: { gap: theme.spacing.md },
  choiceCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: theme.spacing.section,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.5) : theme.colors.secondary,
  },
  choiceCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.brandOrange,
    backgroundColor: withOpacity(theme.colors.brandOrange, 0.04),
  },
  choiceContent: { flex: 1, gap: 4, marginRight: theme.spacing.element },
  choiceLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2,
    color: withOpacity(theme.colors.mutedForeground, 0.4),
    textTransform: "uppercase",
  },
  choiceLabelSelected: { color: theme.colors.brandOrange, fontWeight: "700" },
  choiceTitle: { ...theme.typography.headline, color: theme.colors.foreground },
  choiceSubtitle: {
    ...theme.typography.subheadline,
    color: theme.colors.mutedForeground,
    marginTop: 4,
  },
  choiceRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withOpacity(theme.colors.border, 0.3),
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  choiceRadioSelected: {
    backgroundColor: theme.colors.brandOrange,
    borderColor: theme.colors.brandOrange,
  },

  quizCta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.section,
    paddingBottom: theme.spacing.page,
    paddingTop: theme.spacing.md,
  },

  /* Complete */
  completeSection: {
    alignItems: "center",
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.page,
  },
  ringContainer: { width: 200, height: 200, alignItems: "center", justifyContent: "center" },
  ringCenter: { position: "absolute", alignItems: "center", gap: 4 },
  ringPercent: {
    fontSize: 48,
    fontWeight: "300",
    letterSpacing: -2,
    color: theme.colors.foreground,
  },
  ringLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 2,
    color: theme.colors.mutedForeground,
  },
  completeTitle: {
    fontSize: 36,
    fontStyle: "italic",
    fontWeight: "300",
    color: theme.colors.foreground,
  },
  scoreList: { width: "100%", gap: theme.spacing.element },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.element,
    backgroundColor: theme.isDark ? withOpacity(theme.colors.card, 0.4) : theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.radius.xl,
  },
  scoreLabel: {
    ...theme.typography.body,
    fontWeight: "500",
    color: theme.colors.foreground,
    flex: 1,
  },
  scoreValue: { ...theme.typography.bodyBold, color: theme.colors.foreground },
}));
