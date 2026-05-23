/**
 * App group layout — 5-tab navigation with center Add FAB.
 *
 * Canonical layout per ADR-0268 (Phase 3f, 2026-05-04 handoff):
 *   Kalender · Vakter · ⊕ FAB · Chat · Min Tid
 *
 * FAB tap = return to Kalender (start anchor per ADR-0268).
 * FAB long-press = open BotssonSheet directly (AI discoverability — 2026-05-20).
 * FAB swipe up layer 1 (80px) = open AddSheet.
 * FAB swipe up layer 2 (160px) = open AddSheet + BotssonSheet stacked.
 *
 * FabHint renders a first-run tooltip above the FAB to advertise the long-press
 * AI entry. Auto-dismisses or marks-seen on first long-press / swipe-layer2.
 *
 * Each tab screen manages its own header.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
import { View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import type GorhomBottomSheet from "@gorhom/bottom-sheet";
import { createStyles } from "@/theme";
import { TabBar } from "@/components/navigation/TabBar";
import { AIFab } from "@/components/navigation/AIFab";
import { FabHint } from "@/components/navigation/FabHint";
import { BotssonSheet } from "@/components/ai/BotssonSheet";
import { BotssonProvider, useBotsson } from "@/providers/botsson-provider";
import { useBotssonSettingsStore } from "@/hooks/stores/use-botsson-settings-store";
import { useMyProfile } from "@/hooks/queries/use-my-profile";
import { useUnreadCount } from "@/hooks/queries/use-notifications";
import { strings } from "@/constants/strings";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { AddSheet, type AddSheetHandle } from "@/components/calendar/AddSheet";
import { emit, nonEmpty } from "@smartout/telemetry";
import { getProfileContext } from "@/lib/profile-context";
import { getOnboardingState } from "@/lib/onboarding-bff";

// Initial route = (home) — 3-screen pager (Pre/On/Post shift).
// Supersedes the ADR-0268 anchor decision (was (calendar)).
// Calendar remains accessible via its tab; no longer the landing screen.
export const unstable_settings = {
  initialRouteName: "(home)",
};

/**
 * IntentSheetController — listens for pendingIntent inside BotssonProvider
 * and auto-expands the sheet. Must live inside BotssonProvider so it can
 * call useBotsson(). The ref is forwarded from AppLayout.
 *
 * Separation of concerns: AppLayout owns the ref; this component bridges
 * the provider state to the imperative sheet API without coupling AppLayout
 * to the provider's internal state.
 */
function IntentSheetController({
  sheetRef,
}: {
  sheetRef: React.RefObject<GorhomBottomSheet | null>;
}) {
  const { pendingIntent } = useBotsson();
  useEffect(() => {
    if (pendingIntent) {
      // Expand the sheet so the intent banner is visible immediately.
      sheetRef.current?.expand();
    }
  }, [pendingIntent, sheetRef]);
  return null;
}

export default function AppLayout() {
  const styles = useStyles();
  const router = useRouter();

  const { data: profile } = useMyProfile();
  const { data: unreadNotificationCount = 0 } = useUnreadCount(profile?.profile_id);
  const pathname = usePathname();

  // Track whether the onboarding state check has resolved. We render the layout
  // immediately (no blocking spinner) and redirect only AFTER the fetch settles.
  // This prevents the flash: layout mounts → redirect. If the fetch fails (network
  // error), we fall back to profile-only check so incomplete users still get guided.
  const [onboardingStateChecked, setOnboardingStateChecked] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Redirect to onboarding wizard when the employee has not completed welcome flow.
  //
  // Two-phase guard:
  //   Phase 1 (sync): profile.is_welcome_complete must be false, not undefined
  //                   (=== false, never falsy — undefined = still loading).
  //   Phase 2 (async): consult employee_onboarding_state via GET /state BFF.
  //                    If status='dismissed', skip redirect — employee dismissed the
  //                    wizard intentionally and will resume via CompleteProfileCard CTA.
  //                    The GET handler calls recordWelcomeResume() on next open, which
  //                    clears dismissed_at + flips status='in_progress' (Sortie A fix).
  //
  // Guard pathname to avoid a replace-to-self loop (already on /onboarding).
  useEffect(() => {
    if (!profile) return;
    if (profile.is_welcome_complete !== false) return;

    // Fetch onboarding state once to check for dismissed status.
    // Layout is already visible — this is a post-render side-effect only.
    getOnboardingState()
      .then((state) => {
        setIsDismissed(state.status === "dismissed");
        setOnboardingStateChecked(true);
      })
      .catch(() => {
        // Network error or unauthenticated — fall back to profile-only check.
        // Treat as not dismissed so incomplete users still reach onboarding.
        setIsDismissed(false);
        setOnboardingStateChecked(true);
      });
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    if (profile.is_welcome_complete !== false) return;
    if (!onboardingStateChecked) return;
    if (isDismissed) return;
    if (pathname === "/onboarding") return;

    router.replace("/(app)/onboarding");
  }, [profile, onboardingStateChecked, isDismissed, pathname, router]);

  const botssonSheetRef = useRef<GorhomBottomSheet>(null);
  const addSheetRef = useRef<AddSheetHandle>(null);
  const markFabHintSeen = useBotssonSettingsStore((s) => s.setHasSeenFabHint);

  /** Tap → return to Home (3-screen pager). Supersedes ADR-0268 anchor target. */
  const handleFabTap = useCallback(() => {
    router.replace("/(app)/(home)");
  }, [router]);

  /** Long-press → open BotssonSheet directly (discoverable AI entry). */
  const handleFabLongPress = useCallback(() => {
    markFabHintSeen(true);
    botssonSheetRef.current?.expand();
    // Emit: mobile.fab.long_press (ADR-0134 — non-null IDs required).
    void (async () => {
      try {
        const { profileId, workspaceId } = await getProfileContext();
        void emit({
          event: "mobile.fab.long_press",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { data: { device_type: "mobile" } },
        });
        void emit({
          event: "mobile.botsson_sheet.opened",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { data: { source: "fab_long_press", device_type: "mobile" } },
        });
      } catch {
        // Profile unavailable — skip telemetry; UX must not be blocked.
      }
    })();
  }, [markFabHintSeen]);

  /** Swipe layer 1 (≥80px up) → open AddSheet only. */
  const handleFabSwipeLayer1 = useCallback(() => {
    addSheetRef.current?.open();
  }, []);

  /** Swipe layer 2 (≥160px up) → open AddSheet + BotssonSheet stacked. */
  const handleFabSwipeLayer2 = useCallback(() => {
    markFabHintSeen(true);
    addSheetRef.current?.open();
    botssonSheetRef.current?.expand();
    // Emit: mobile.botsson_sheet.opened (source = fab_swipe_layer_2).
    void (async () => {
      try {
        const { profileId, workspaceId } = await getProfileContext();
        void emit({
          event: "mobile.botsson_sheet.opened",
          workspace_id: nonEmpty(workspaceId, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: { data: { source: "fab_swipe_layer_2", device_type: "mobile" } },
        });
      } catch {
        // Profile unavailable — skip telemetry; UX must not be blocked.
      }
    })();
  }, [markFabHintSeen]);

  const handleBotssonDismiss = useCallback(() => {
    botssonSheetRef.current?.close();
  }, []);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <TabBar
        {...props}
        unreadNotificationCount={unreadNotificationCount}
        centerFab={
          <AIFab
            onTap={handleFabTap}
            onLongPress={handleFabLongPress}
            onSwipeLayer1={handleFabSwipeLayer1}
            onSwipeLayer2={handleFabSwipeLayer2}
          />
        }
      />
    ),
    [
      handleFabTap,
      handleFabLongPress,
      handleFabSwipeLayer1,
      handleFabSwipeLayer2,
      unreadNotificationCount,
    ],
  );

  return (
    <BotssonProvider>
      {/* Watches pendingIntent and auto-expands the sheet on openWithIntent calls */}
      <IntentSheetController sheetRef={botssonSheetRef} />
      <View style={styles.container}>
        <Tabs
          screenOptions={{ headerShown: false }}
          initialRouteName="(home)"
          tabBar={renderTabBar}
        >
          {/* ── Tab bar layout: Home · Vakter · FAB · Chat · Min Tid ────── */}
          <Tabs.Screen name="(home)" options={{ title: "Hjem" }} />
          <Tabs.Screen name="(shifts)" options={{ title: strings.tabs.vakter }} />
          {/* FAB slot: center button in TabBar — no navigable route */}
          <Tabs.Screen name="(chat)" options={{ title: strings.tabs.chat }} />
          <Tabs.Screen name="(me)" options={{ title: strings.tabs.minTid }} />

          {/* ── Hidden — Calendar still reachable but not in tab bar ────── */}
          <Tabs.Screen name="(calendar)" options={{ href: null }} />
          {/* Onboarding wizard — full-screen modal, never appears in tab bar */}
          <Tabs.Screen name="onboarding" options={{ href: null }} />
          {/* digest.tsx deleted 2026-05-14 (ADR-0318) — no suppression needed */}
          <Tabs.Screen name="(komm)" options={{ href: null }} />
          <Tabs.Screen name="(queue)" options={{ href: null }} />
          {/* Suppress journey/[id]/guided dynamic route from auto-tab-leak.
              (No bare "journey" route exists — only the [id]/guided screen.) */}
          <Tabs.Screen name="journey/[id]/guided" options={{ href: null }} />
          {/* Routine review — navigated to from BotssonSheet after draft extraction. */}
          <Tabs.Screen name="routine-review" options={{ href: null }} />
        </Tabs>

        {/* AddSheet mounts before BotssonSheet so BotssonSheet renders on top (higher z-index). */}
        <AddSheet ref={addSheetRef} selectedDate={new Date()} />
        <BotssonSheet ref={botssonSheetRef} onDismiss={handleBotssonDismiss} />
        <FabHint message={strings.botsson.fabHint} />
      </View>
    </BotssonProvider>
  );
}

const useStyles = createStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
}));
