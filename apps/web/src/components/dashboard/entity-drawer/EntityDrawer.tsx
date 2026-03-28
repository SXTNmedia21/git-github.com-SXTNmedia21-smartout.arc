"use client";

/**
 * EntityDrawer — hybrid sheet/pin panel for entity inspection.
 * Sheet mode: overlay from right with backdrop.
 * Pinned mode: persistent split-panel, main content narrows.
 * Mobile: fullscreen takeover.
 *
 * Tab content is resolved via the entity registry (entity-config.ts)
 * and lazy-loaded per entity type. The --entity-accent CSS custom
 * property drives all accent coloring per entity.
 */

import { lazy, Suspense, useCallback, useContext, useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Pin, PinOff, X, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@smartout/i18n";
import { emit } from "@smartout/telemetry";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useEntityDrawer, type EntityType } from "./EntityDrawerContext";
import { entityRegistry, getEntityHref } from "./entity-config";
import { DrawerSkeleton } from "./shared/DrawerSkeleton";
import { motion as motionTokens } from "@smartout/design-tokens";

const panelSpring = {
  type: "spring" as const,
  stiffness: motionTokens.spring.stiffness,
  damping: motionTokens.spring.damping,
  mass: motionTokens.spring.mass,
};

const swapSpring = {
  type: "spring" as const,
  stiffness: motionTokens.springSnappy.stiffness,
  damping: motionTokens.springSnappy.damping,
  mass: motionTokens.springSnappy.mass,
};

/* Lazy tab component map — keyed by "entityType:tabValue" */
const tabComponents: Record<
  string,
  React.LazyExoticComponent<React.ComponentType<{ entityId: string }>>
> = {
  "cascade_task:context": lazy(() =>
    import("./tabs/cascade-task/CascadeTaskTab").then((m) => ({
      default: m.CascadeTaskTab as React.ComponentType<{ entityId: string }>,
    })),
  ),
  "department:details": lazy(() =>
    import("./tabs/department/DepartmentDetailTab").then((m) => ({
      default: m.DepartmentDetailTab as React.ComponentType<{ entityId: string }>,
    })),
  ),
  "shift:details": lazy(() =>
    import("./tabs/shift/ShiftDetailTab").then((m) => ({
      default: m.ShiftDetailTab,
    })),
  ),
  "profile:summary": lazy(() =>
    import("./tabs/profile/ProfileSummaryTab").then((m) => ({
      default: m.ProfileSummaryTab,
    })),
  ),
  "department_session:summary": lazy(() =>
    import("./tabs/department-session/SessionSummaryTab").then((m) => ({
      default: m.SessionSummaryTab,
    })),
  ),
};

/** Resolve tab content via lazy component map, falling back to "coming soon" */
function resolveTabContent(
  entityType: EntityType,
  tabValue: string,
  entityId: string,
  t: (key: string) => string,
): React.ReactNode {
  const key = `${entityType}:${tabValue}`;
  const Component = tabComponents[key];
  if (!Component) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        {t("entity_drawer.coming_soon")}
      </div>
    );
  }
  return (
    <Suspense fallback={<DrawerSkeleton />}>
      <Component entityId={entityId} />
    </Suspense>
  );
}

export function EntityDrawer() {
  const { state, closeDrawer, pinDrawer, unpinDrawer, setActiveTab } = useEntityDrawer();
  const { isOpen, isPinned, entityType, entityId, activeTab } = state;
  const { t } = useTranslation("dashboard");
  const router = useRouter();
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id ?? null;
  const { profileId } = useContext(DashboardContext);
  const shouldReduceMotion = useReducedMotion();
  const openedAtRef = useRef<number>(0);

  /** Track open time for duration telemetry */
  useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    const duration = Date.now() - openedAtRef.current;
    if (entityType && entityId) {
      void emit({
        event: "entity_drawer closed",
        workspace_id: wsId,
        actor_id: profileId ?? "",
        properties: {
          data: { entity_type: entityType, entity_id: entityId, duration_ms: duration },
        },
      });
    }
    closeDrawer();
  }, [closeDrawer, entityType, entityId, wsId]);

  const handlePin = useCallback(() => {
    if (isPinned) {
      unpinDrawer();
    } else {
      pinDrawer();
      if (entityType && entityId) {
        void emit({
          event: "entity_drawer pinned",
          workspace_id: wsId,
          actor_id: profileId ?? "",
          properties: { data: { entity_type: entityType, entity_id: entityId } },
        });
      }
    }
  }, [isPinned, pinDrawer, unpinDrawer, entityType, entityId, wsId]);

  const handleTabSwitch = useCallback(
    (tab: string) => {
      const fromTab = activeTab;
      setActiveTab(tab);
      if (entityType && entityId && fromTab) {
        void emit({
          event: "entity_drawer tab_switched",
          workspace_id: wsId,
          actor_id: profileId ?? "",
          properties: {
            data: { entity_type: entityType, entity_id: entityId, from_tab: fromTab, to_tab: tab },
          },
        });
      }
    },
    [setActiveTab, activeTab, entityType, entityId, wsId],
  );

  const handleOpenFullPage = useCallback(() => {
    if (!entityType || !entityId) return;
    const href = getEntityHref(entityType, entityId);
    if (href) {
      closeDrawer();
      router.push(href);
    }
  }, [entityType, entityId, closeDrawer, router]);

  /** Escape key closes sheet mode */
  useEffect(() => {
    if (!isOpen || isPinned) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isPinned, handleClose]);

  if (!isOpen || !entityType || !entityId) return null;

  const config = entityRegistry[entityType];
  const EntityIcon = config.icon;
  const tabs = config.tabs.map((tab) => ({
    ...tab,
    content: resolveTabContent(entityType, tab.value, entityId, t),
  }));
  const currentTab = activeTab ?? tabs[0]?.value ?? "details";
  const currentTabContent = tabs.find((tab) => tab.value === currentTab)?.content ?? null;
  const fullPageHref = getEntityHref(entityType, entityId);

  const drawerContent = (
    <div
      className="relative flex h-full flex-col overflow-hidden"
      role={isPinned ? "complementary" : "dialog"}
      aria-modal={!isPinned}
      aria-label={`${t(config.labelKey)} details`}
      style={{ "--entity-accent": config.accent } as React.CSSProperties}
    >
      {/* Ambient glow — uses entity accent color */}
      <div
        className="pointer-events-none absolute -top-8 -right-5 h-[120px] w-[120px] rounded-full opacity-[0.08]"
        style={{
          background: `radial-gradient(circle, var(--entity-accent), transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      {/* Noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 border-b border-border px-4 pt-4 pb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-foreground"
          style={{
            background: `color-mix(in oklch, var(--entity-accent) 15%, transparent)`,
            color: "var(--entity-accent)",
          }}
        >
          <EntityIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{entityId}</div>
          <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {t(config.labelKey)}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handlePin}
            aria-pressed={isPinned}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
              isPinned
                ? ""
                : "border-border text-muted-foreground hover:bg-muted/50 hover:text-muted-foreground"
            }`}
            style={
              isPinned
                ? {
                    borderColor: "var(--entity-accent)",
                    backgroundColor:
                      "color-mix(in oklch, var(--entity-accent) 10%, transparent)",
                  }
                : undefined
            }
            title={isPinned ? t("entity_drawer.unpin") : t("entity_drawer.pin")}
          >
            {isPinned ? (
              <PinOff
                className="h-3.5 w-3.5"
                style={isPinned ? { color: "var(--entity-accent)" } : undefined}
              />
            ) : (
              <Pin className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
            title={t("entity_drawer.close")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="relative z-10 border-b border-border">
          <div
            className="scrollbar-none flex gap-0 overflow-x-auto px-4"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={currentTab === tab.value}
                aria-controls={`tabpanel-${tab.value}`}
                onClick={() => handleTabSwitch(tab.value)}
                className={`min-h-[44px] border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors ${
                  currentTab === tab.value
                    ? "border-[color:var(--entity-accent)] font-semibold text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground/70"
                }`}
              >
                {t(tab.labelKey)}
                {tab.badge && tab.badge > 0 ? (
                  <span className="text-destructive ml-1.5 text-[9px] font-bold">{tab.badge}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        id={`tabpanel-${currentTab}`}
        role="tabpanel"
        className="relative z-10 min-h-0 flex-1 overflow-y-auto"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={shouldReduceMotion ? { opacity: 0.8 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0.8 } : { opacity: 0, y: -8 }}
            transition={shouldReduceMotion ? { duration: 0.1 } : swapSpring}
          >
            {currentTabContent}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {fullPageHref && (
        <div className="relative z-10 border-t border-border p-3">
          <button
            onClick={handleOpenFullPage}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-transparent py-2 text-[11px] text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
          >
            {t("entity_drawer.open_full_page")}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );

  /** Sheet mode — overlay from right */
  if (!isPinned) {
    return (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[29] bg-background/80"
          onClick={handleClose}
        />
        {/* Sheet */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={shouldReduceMotion ? { duration: 0.15 } : { ...panelSpring }}
          className="fixed top-0 right-0 bottom-0 z-[30] w-[380px] max-w-[90vw] rounded-l-2xl border-l border-border shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]"
          style={{
            background: "oklch(0.18 0.03 50)",
            backdropFilter: "blur(20px)",
          }}
        >
          {drawerContent}
        </motion.div>
      </>
    );
  }

  /** Pinned mode — inline panel */
  return (
    <motion.div
      layout
      transition={shouldReduceMotion ? { duration: 0 } : panelSpring}
      className="h-full w-[380px] shrink-0 rounded-2xl border border-border shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]"
      style={{
        background: "oklch(0.18 0.03 50)",
        backdropFilter: "blur(20px)",
      }}
    >
      {drawerContent}
    </motion.div>
  );
}
