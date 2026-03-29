"use client";

/**
 * EntityDrawerContext — isolated state for the entity drawer.
 * Lives outside DashboardContext to avoid re-rendering 170+ consumers
 * on every drawer open/close.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type EntityType =
  | "department"
  | "profile"
  | "team"
  | "shift"
  | "department_session"
  | "shift_template"
  | "cascade_task";

export type DrawerState = {
  isOpen: boolean;
  isPinned: boolean;
  entityType: EntityType | null;
  entityId: string | null;
  activeTab: string | null;
};

type EntityDrawerContextValue = {
  state: DrawerState;
  openDrawer: (type: EntityType, id: string, tab?: string) => void;
  closeDrawer: () => void;
  pinDrawer: () => void;
  unpinDrawer: () => void;
  setActiveTab: (tab: string) => void;
};

const CLOSED_STATE: DrawerState = {
  isOpen: false,
  isPinned: false,
  entityType: null,
  entityId: null,
  activeTab: null,
};

const PIN_STORAGE_KEY = "smartout:entity-drawer-pinned";
const MOBILE_BREAKPOINT = 768;

const EntityDrawerCtx = createContext<EntityDrawerContextValue | null>(null);

export function EntityDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<DrawerState>(CLOSED_STATE);

  /** Restore pin preference from localStorage on mount */
  useEffect(() => {
    const saved = localStorage.getItem(PIN_STORAGE_KEY);
    if (saved === "true" && window.innerWidth >= MOBILE_BREAKPOINT) {
      setState((prev) => ({ ...prev, isPinned: true }));
    }
  }, []);

  /** Close drawer on route change — preserve pin preference */
  useEffect(() => {
    setState((prev) => ({ ...CLOSED_STATE, isPinned: prev.isPinned }));
  }, [pathname]);

  /** Auto-unpin on mobile resize */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < MOBILE_BREAKPOINT) {
        setState((prev) => (prev.isPinned ? { ...prev, isPinned: false } : prev));
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openDrawer = useCallback((type: EntityType, id: string, tab?: string) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      entityType: type,
      entityId: id,
      activeTab: tab ?? null,
    }));
  }, []);

  const closeDrawer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      entityType: null,
      entityId: null,
      activeTab: null,
    }));
  }, []);

  const pinDrawer = useCallback(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) return;
    localStorage.setItem(PIN_STORAGE_KEY, "true");
    setState((prev) => ({ ...prev, isPinned: true }));
  }, []);

  const unpinDrawer = useCallback(() => {
    localStorage.setItem(PIN_STORAGE_KEY, "false");
    setState((prev) => ({ ...prev, isPinned: false }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const value = useMemo<EntityDrawerContextValue>(
    () => ({ state, openDrawer, closeDrawer, pinDrawer, unpinDrawer, setActiveTab }),
    [state, openDrawer, closeDrawer, pinDrawer, unpinDrawer, setActiveTab],
  );

  return <EntityDrawerCtx.Provider value={value}>{children}</EntityDrawerCtx.Provider>;
}

export function useEntityDrawer(): EntityDrawerContextValue {
  const ctx = useContext(EntityDrawerCtx);
  if (!ctx) throw new Error("useEntityDrawer must be used within EntityDrawerProvider");
  return ctx;
}
