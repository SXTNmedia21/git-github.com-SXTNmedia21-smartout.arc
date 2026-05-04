/**
 * Clockout Wizard — M2 6-step reconciliation flow (mobile).
 *
 * Feature-flagged via EXPO_PUBLIC_RECON_WIZARD_V2.
 *
 * Invariants (see docs/plans/CAMPAIGN-daily-operation.md):
 *   #7  Role-gated mount — duty_leader_id ?? opened_by.
 *   #8  Resumability — load wizard_state + show staleness prompt when
 *        last_touched_at > NOW-12h (soft; never auto-reset).
 *   #11 Split-shift handoff — BeforeShiftView surfaces last-closed
 *        session from M3 (separate sub-sortie).
 *   #12 Riksavtalen lønn Estimat marker when tariff-derivation missing.
 *   #13 No blockers — soft prompt, never auto-reset.
 *
 * Deep-link source: smartout://clockout?sessionId=...&source=push. We
 * preserve `source` for telemetry but do not alter behaviour.
 *
 * Hospitality Q7 flag stub — cross-campaign ADR pending.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";

import {
  WizardHeader,
  UnsavedChangesSheet,
  AdminOverrideSheet,
  StalenessBanner,
  OfflineQueuePill,
  StepSyncIndicator,
  LeaderOnlyEmptyState,
} from "@/components/reconciliation/_shared";
import { bffOverrideWizardBlocker } from "@/lib/reconciliation-bff";
import { Step00StempletUt } from "@/components/reconciliation/steps/Step00StempletUt";
import { Step01Oversikt } from "@/components/reconciliation/steps/Step01Oversikt";
import { Step02Omsetning } from "@/components/reconciliation/steps/Step02Omsetning";
import { Step03Kontanttelling } from "@/components/reconciliation/steps/Step03Kontanttelling";
import { Step04Avvik } from "@/components/reconciliation/steps/Step04Avvik";
import { Step05SeGjennom } from "@/components/reconciliation/steps/Step05SeGjennom";
import { Step06Sendt } from "@/components/reconciliation/steps/Step06Sendt";
import { useIsOnline } from "@/hooks/useIsOnline";
import {
  STEP_ORDER,
  deriveSyncState,
  useIsDutyLeaderForSession,
  useReconWizard,
  useReconWizardState,
  wizardStaleMinutes,
  type WizardStateShape,
  type WizardStepId,
} from "@/hooks/mutations/use-recon-wizard";
import { createStyles, useTheme } from "@/theme";
import { Button } from "@/components/ui/Button";

// ── Hospitality Q7 deferred flags ─────────────────────────────────
// TODO-Q7-ADR: hospitality flags (cash_handling_enabled, tips_enabled,
// haccp_enabled) deferred to future cross-campaign ADR. M2 renders all
// steps unconditionally for Café Skuta hospitality pilot. When Q7-ADR
// lands, replace `true` with flag lookup.
const showCashStep = true; // TODO-Q7-ADR
const showTipsStep = true; // TODO-Q7-ADR
const showHaccpSection = true; // TODO-Q7-ADR
void showTipsStep; // consumed by Step01 tips row in Phase B (future)
void showHaccpSection; // consumed by Step04 HACCP section in Phase B (future)

const FEATURE_FLAG = process.env.EXPO_PUBLIC_RECON_WIZARD_V2 === "1";
const STALE_MINUTE_THRESHOLD = 12 * 60; // Invariant #13 staleness prompt threshold

type StepKey = (typeof STEP_ORDER)[number];

function summaryRows(state: WizardStateShape | null): Array<{ label: string; value: string }> {
  if (!state) return [];
  const rows: Array<{ label: string; value: string }> = [];
  const r = state.step_data ?? {};
  const omsetning = (r["02_omsetning"]?.revenue_total as number | null | undefined) ?? null;
  if (omsetning !== null) {
    rows.push({ label: "Omsetning", value: `${Math.round(omsetning).toLocaleString("nb-NO")} kr` });
  }
  const cashTotal = (r["03_kontanttelling"]?.cash_count_total as number | null | undefined) ?? null;
  if (cashTotal !== null) {
    rows.push({ label: "Kontant talt", value: `${cashTotal.toLocaleString("nb-NO")} kr` });
  }
  const variance =
    (r["03_kontanttelling"]?.cash_count_variance as number | null | undefined) ?? null;
  if (variance !== null) {
    rows.push({
      label: "Kontantavvik",
      value: `${variance > 0 ? "+" : ""}${variance.toLocaleString("nb-NO")} kr`,
    });
  }
  const devCount = (r["04_avvik"]?.deviations_count as number | null | undefined) ?? null;
  if (devCount !== null) rows.push({ label: "Avvik", value: String(devCount) });
  return rows;
}

function computeBlockers(state: WizardStateShape | null): Array<{ code: string; label: string }> {
  if (!state) return [];
  const r = state.step_data ?? {};
  const blockers: Array<{ code: string; label: string }> = [];

  if (showCashStep) {
    const cashTotal = r["03_kontanttelling"]?.cash_count_total;
    if (cashTotal === undefined) {
      blockers.push({ code: "missing_cash_count", label: "Kontanttelling mangler" });
    }
  }
  const unresolved = r["04_avvik"]?.deviations_unresolved as number | undefined;
  if (typeof unresolved === "number" && unresolved > 0) {
    blockers.push({
      code: "open_deviation",
      label: `${unresolved} uløste avvik`,
    });
  }
  return blockers;
}

export default function ClockoutWizardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string; source?: string }>();
  const sessionId = (params.sessionId as string | undefined) ?? "";
  const online = useIsOnline();
  const styles = useStyles();

  // Feature-flag guard — renders an informational screen rather than
  // erroring the nav. Flag flip is deploy-time only.
  if (!FEATURE_FLAG) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <DisabledView onClose={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!sessionId) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <DisabledView onClose={() => router.back()} missingSessionId />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <WizardBody sessionId={sessionId} online={online} source={params.source ?? null} />
    </SafeAreaView>
  );
}

function WizardBody({
  sessionId,
  online,
  source,
}: {
  sessionId: string;
  online: boolean;
  source: string | null;
}) {
  const router = useRouter();
  const styles = useStyles();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const isLeaderQ = useIsDutyLeaderForSession(sessionId);
  const stateQ = useReconWizardState(sessionId);
  const recon = useReconWizard(sessionId);
  const unsavedSheetRef = useRef<GorhomBottomSheet>(null);
  const overrideSheetRef = useRef<GorhomBottomSheet>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [resumePromptHandled, setResumePromptHandled] = useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const wizardState = useMemo<WizardStateShape | null>(() => {
    const raw = stateQ.data?.wizard_state;
    if (!raw || typeof raw !== "object" || !("last_touched_at" in raw)) return null;
    return raw as WizardStateShape;
  }, [stateQ.data]);

  // Invariant #8 — soft resume. If last_touched_at > 12h, prompt once
  // (per mount) to continue or start fresh. Never auto-reset.
  const staleMinutes = wizardStaleMinutes(stateQ.data ?? null);
  const showStalePrompt =
    staleMinutes !== null && staleMinutes >= STALE_MINUTE_THRESHOLD && !resumePromptHandled;

  // Compute starting step from wizard_state on first load.
  React.useEffect(() => {
    if (!wizardState || currentIdx > 0) return;
    const last = wizardState.last_completed_step ?? -1;
    const next = Math.max(0, Math.min(STEP_ORDER.length - 1, last + 1));
    setCurrentIdx(next);
  }, [wizardState, currentIdx]);

  const handleClose = useCallback(() => {
    if (dirty) {
      unsavedSheetRef.current?.snapToIndex(0);
    } else {
      router.back();
    }
  }, [dirty, router]);

  const handleSaveStep = useCallback(
    async (stepId: WizardStepId, stepData: Record<string, unknown>) => {
      try {
        await recon.saveStep({ stepId, stepData });
        setDirty(false);
        const nextIdx = Math.min(STEP_ORDER.length - 1, currentIdx + 1);
        setCurrentIdx(nextIdx);
      } catch (err) {
        // StepSyncIndicator renders "error" — user retries via onNext.
        console.warn("[clockout] saveStep failed", err);
        throw err;
      }
    },
    [currentIdx, recon],
  );

  const handleSubmit = useCallback(async () => {
    try {
      await recon.submitWizard();
      setCurrentIdx(STEP_ORDER.indexOf("06_sendt"));
    } catch (err) {
      console.warn("[clockout] submit failed", err);
    }
  }, [recon]);

  const handleOverrideConfirm = useCallback(
    async (reason: string) => {
      // Closure Item 4 — admin override persists via the web BFF
      // (apps/web/src/app/api/reconciliation/wizard-override/route.ts),
      // which re-derives identity server-side (ADR-0176 Invariant 3),
      // gates on `signoff.admin_override`, and mirrors the web Server
      // Action's override semantics (status → 'submitted', approval_notes
      // prefixed with [OVERRIDE BLOCKER: ...]). Telemetry event
      // `reconciliation admin_override` writes to activity_trail with
      // override=true + gate_blocked codes.
      const blockers = computeBlockers(wizardState).map((b) => b.code);
      if (blockers.length === 0) {
        Alert.alert("Ingen blokker", "Det er ingen aktive blokkerer å overstyre.");
        return;
      }

      setOverrideSubmitting(true);
      try {
        const result = await bffOverrideWizardBlocker(sessionId, reason, blockers);
        if (!result.ok) {
          Alert.alert("Kunne ikke overstyre", result.error);
          return;
        }
        // Invalidate the wizard-state cache so the screen reflects the new
        // `submitted` status; advance UI to the receipt step.
        await queryClient.invalidateQueries({ queryKey: ["recon-wizard", sessionId] });
        overrideSheetRef.current?.close();
        setCurrentIdx(STEP_ORDER.indexOf("06_sendt"));
      } finally {
        setOverrideSubmitting(false);
      }
    },
    [sessionId, wizardState, queryClient],
  );

  // Source is preserved for telemetry — emit on mount if push-sourced.
  React.useEffect(() => {
    if (source === "push") {
      // Lightweight marker — full event registered via trg push trigger.
      // Local mount audit only.
    }
  }, [source]);

  if (isLeaderQ.isLoading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loading}>Laster…</Text>
      </View>
    );
  }

  if (!isLeaderQ.data?.isLeader) {
    return (
      <LeaderOnlyEmptyState
        sessionOpen={isLeaderQ.data?.sessionOpen ?? false}
        onBack={() => router.back()}
      />
    );
  }

  const blockers = computeBlockers(wizardState);
  const summary = summaryRows(wizardState);
  const syncState = deriveSyncState(recon.saveStepState, online);

  // M2 polish #7 — leader's punch-out time piggybacked onto the role-gate
  // query. Null until the leader has punched out; Step00 renders "—".
  const leaderPunchOutTime = isLeaderQ.data?.leaderPunchOutTime ?? null;

  // M2 polish #6 — real department name from the session's department.name
  // JOIN on the same role-gate query. Falls back to the generic label if
  // the JOIN returned null (new session, FK lag).
  const deptName = isLeaderQ.data?.departmentName ?? null;
  const headerLabel = deptName ? `${deptName} — Dagens avstemming` : "Dagens avstemming";

  return (
    <View style={styles.flex}>
      <WizardHeader
        departmentName={headerLabel}
        currentStep={currentIdx}
        totalSteps={STEP_ORDER.length}
        hasUnsavedChanges={dirty}
        onClose={handleClose}
      />
      <View style={styles.belowHeader}>
        <OfflineQueuePill visible={!online} queueDepth={0} />
        {showStalePrompt ? (
          <StalenessPrompt
            staleMinutes={staleMinutes ?? 0}
            onContinue={() => setResumePromptHandled(true)}
            onStartOver={() => {
              // Soft — we do not delete wizard_state. We simply reset the
              // local index. Persistence remains intact for audit.
              setCurrentIdx(0);
              setResumePromptHandled(true);
            }}
          />
        ) : null}
        {!showStalePrompt && staleMinutes !== null && staleMinutes >= 60 ? (
          <StalenessBanner staleMinutes={staleMinutes} />
        ) : null}
        <View style={styles.syncRow}>
          <StepSyncIndicator state={syncState} />
        </View>
      </View>

      <View style={styles.stepWrap}>
        {currentIdx === 0 ? (
          <Step00StempletUt
            punchOutTime={leaderPunchOutTime}
            onNext={(d) => handleSaveStep("00_stempletut", d)}
            disabled={recon.saveStepState.isPending}
          />
        ) : null}
        {currentIdx === 1 ? (
          <Step01Oversikt
            omsetning={null}
            dekningsgrad={null}
            timer={null}
            lonnskost={null}
            lonnEstimateOnly={true}
            onNext={(d) => handleSaveStep("01_oversikt", d)}
            disabled={recon.saveStepState.isPending}
          />
        ) : null}
        {currentIdx === 2 ? (
          <Step02Omsetning
            ocrRevenueTotal={null}
            ocrRevenueCard={null}
            ocrRevenueCash={null}
            ocrTransactions={null}
            onNext={(d) => handleSaveStep("02_omsetning", d)}
            disabled={recon.saveStepState.isPending}
          />
        ) : null}
        {currentIdx === 3 && showCashStep ? (
          <Step03Kontanttelling
            expectedCash={
              (wizardState?.step_data?.["02_omsetning"]?.revenue_cash as number | undefined) ?? null
            }
            onNext={(d) => handleSaveStep("03_kontanttelling", d)}
            disabled={recon.saveStepState.isPending}
          />
        ) : null}
        {currentIdx === 4 ? (
          <Step04Avvik
            deviations={[]}
            onNext={(d) => handleSaveStep("04_avvik", d)}
            disabled={recon.saveStepState.isPending}
          />
        ) : null}
        {currentIdx === 5 ? (
          <Step05SeGjennom
            summary={summary}
            blockers={blockers}
            onSubmit={handleSubmit}
            onRequestOverride={() => overrideSheetRef.current?.snapToIndex(0)}
            submitting={recon.submitState.isPending}
          />
        ) : null}
        {currentIdx === 6 ? (
          <Step06Sendt
            summary={summary.map((s) => `${s.label}: ${s.value}`).join(" · ")}
            onClose={() => router.back()}
          />
        ) : null}
      </View>

      <UnsavedChangesSheet
        ref={unsavedSheetRef}
        onContinueLater={() => {
          unsavedSheetRef.current?.close();
          router.back();
        }}
        onCancelEntirely={() => {
          // Soft-cancel: we do not nuke wizard_state (Invariant #13).
          unsavedSheetRef.current?.close();
          router.back();
        }}
      />
      <AdminOverrideSheet
        ref={overrideSheetRef}
        blockerCodes={blockers.map((b) => b.code)}
        onConfirm={(reason) => void handleOverrideConfirm(reason)}
        submitting={overrideSubmitting}
      />
    </View>
  );
}

function StalenessPrompt({
  staleMinutes,
  onContinue,
  onStartOver,
}: {
  staleMinutes: number;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const styles = useStyles();
  const hours = Math.max(1, Math.floor(staleMinutes / 60));
  return (
    <View style={styles.stalePrompt}>
      <Text style={styles.stalePromptTitle}>Fortsette der du slapp?</Text>
      <Text style={styles.stalePromptBody}>
        Avstemmingen ble sist lagret for over {hours} timer siden. Vi tar vare på dine tall uansett.
      </Text>
      <View style={styles.stalePromptActions}>
        <Button title="Fortsett" variant="primary" size="md" onPress={onContinue} />
        <Button title="Start på nytt" variant="ghost" size="md" onPress={onStartOver} />
      </View>
    </View>
  );
}

function DisabledView({
  onClose,
  missingSessionId,
}: {
  onClose: () => void;
  missingSessionId?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.centered}>
      <Text style={styles.heading}>
        {missingSessionId ? "Ingen økt valgt" : "Ikke tilgjengelig ennå"}
      </Text>
      <Text style={styles.body}>
        {missingSessionId
          ? "Åpne denne skjermen fra push-varselet eller dagens økt."
          : "Funksjonen er under utrulling. Slå på EXPO_PUBLIC_RECON_WIZARD_V2 for å ta den i bruk."}
      </Text>
      <Button title="Tilbake" variant="primary" size="md" onPress={onClose} />
    </View>
  );
}

const useStyles = createStyles((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.page,
    gap: theme.spacing.element,
  },
  belowHeader: {
    paddingHorizontal: theme.spacing.card,
    paddingTop: theme.spacing.element,
    gap: theme.spacing.element,
  },
  syncRow: { alignSelf: "flex-end" },
  stepWrap: { flex: 1 },
  stalePrompt: {
    padding: theme.spacing.card,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.muted,
    gap: theme.spacing.element,
  },
  stalePromptTitle: { ...theme.typography.headline, color: theme.colors.foreground },
  stalePromptBody: { ...theme.typography.subheadline, color: theme.colors.mutedForeground },
  stalePromptActions: { flexDirection: "row", gap: theme.spacing.element },
  heading: { ...theme.typography.title, color: theme.colors.foreground, textAlign: "center" },
  body: { ...theme.typography.body, color: theme.colors.mutedForeground, textAlign: "center" },
  loading: { ...theme.typography.body, color: theme.colors.mutedForeground },
}));
