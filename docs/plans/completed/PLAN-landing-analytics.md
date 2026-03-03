---
title: "Plan — Landing Session Tracking"
status: done
updated: 2026-03-03
created: 2026-03-01
module: landing
tags: [plan, analytics, tracking, sessions]
---

# Landing Session Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Full landing page session tracking with cookie-based visitor identification, scroll/click/time tracking, returning visitor detection, and an admin sessions dashboard with detail views.

**Architecture:** Extend existing `landing_event` table + new `landing_visitor` and `landing_session` tables in Supabase. Client-side cookie (`smo_vid`) identifies visitors across sessions. Enhanced `/api/track` endpoint handles new event types and upserts visitor/session aggregates. New admin dashboard tabs show sessions list and session detail timelines.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (PostgreSQL), TanStack Table, shadcn/ui (tabs, sheet, dialog, badge), Zod, navigator.sendBeacon

**Design doc:** `docs/plans/2026-03-01-landing-session-tracking-design.md`

---

## Task 1: Database Migration — New Tables + landing_event Extension

**Files:**

- Create: `supabase/migrations/20260301600000_landing_session_tracking.sql`

**Step 1: Write the migration**

```sql
-- ============================================
-- 20260301600000_landing_session_tracking.sql
-- Adds landing_visitor and landing_session tables,
-- extends landing_event with visitor_id column.
-- No RLS — platform-admin tables, service role only.
-- ============================================

-- 1. Visitor table — one row per unique cookie (smo_vid)
CREATE TABLE public.landing_visitor (
  id                uuid PRIMARY KEY,                          -- = smo_vid cookie value
  first_seen        timestamptz NOT NULL DEFAULT now(),
  last_seen         timestamptz NOT NULL DEFAULT now(),
  visit_count       int NOT NULL DEFAULT 1,
  first_referrer    text,
  first_variant     text,
  ip_addresses      text[] NOT NULL DEFAULT '{}',
  user_agents       text[] NOT NULL DEFAULT '{}',
  -- Identification (linked after signup or manual admin tag)
  user_identity_id  uuid REFERENCES public.user_identity(id) ON DELETE SET NULL,
  manual_label      text,
  manual_notes      text,
  tagged_by         uuid REFERENCES public.user_identity(id) ON DELETE SET NULL,
  tagged_at         timestamptz,
  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_visitor_last_seen ON public.landing_visitor(last_seen DESC);
CREATE INDEX idx_landing_visitor_identity ON public.landing_visitor(user_identity_id)
  WHERE user_identity_id IS NOT NULL;

-- 2. Session table — one row per browser tab session
CREATE TABLE public.landing_session (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        uuid NOT NULL REFERENCES public.landing_visitor(id) ON DELETE CASCADE,
  session_id        text NOT NULL,                             -- browser sessionStorage ID
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_seconds  int,
  max_scroll_depth  int NOT NULL DEFAULT 0,                    -- 0-100%
  page_count        int NOT NULL DEFAULT 0,
  click_count       int NOT NULL DEFAULT 0,
  cta_click_count   int NOT NULL DEFAULT 0,
  variant           text,
  referrer          text,
  ip_address        inet,
  user_agent        text,
  device_type       text,                                      -- 'desktop' | 'mobile' | 'tablet'
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_session_visitor ON public.landing_session(visitor_id);
CREATE INDEX idx_landing_session_started ON public.landing_session(started_at DESC);
CREATE UNIQUE INDEX idx_landing_session_sid ON public.landing_session(session_id);

-- 3. Extend landing_event with visitor_id
ALTER TABLE public.landing_event
  ADD COLUMN visitor_id uuid REFERENCES public.landing_visitor(id) ON DELETE SET NULL;

CREATE INDEX idx_landing_event_visitor ON public.landing_event(visitor_id)
  WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_landing_event_session ON public.landing_event(session_id)
  WHERE session_id IS NOT NULL;
```

**Step 2: Apply the migration locally**

Run: `cd /home/sxtnl/dev/wt-6 && npx supabase db reset`
Expected: Migration applies without errors. All three tables exist.

**Step 3: Regenerate TypeScript types**

Run: `cd /home/sxtnl/dev/wt-6 && npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`
Expected: `database.types.ts` now contains `landing_visitor`, `landing_session` types, and `landing_event` has `visitor_id`.

**Step 4: Commit**

```bash
git add supabase/migrations/20260301600000_landing_session_tracking.sql packages/supabase/src/database.types.ts
git commit -m "feat(db): add landing_visitor and landing_session tables, extend landing_event"
```

---

## Task 2: Visitor Cookie Manager

**Files:**

- Create: `apps/landing/src/lib/visitor-cookie.ts`

**Step 1: Write the cookie utility**

```typescript
// ============================================
// visitor-cookie.ts
// Manages the smo_vid cookie for persistent visitor identification.
// Cookie persists 365 days across browser sessions.
// Not httpOnly — must be readable by client JS for event tagging.
//
// Connected to: hooks/useTracking.ts (reads visitor_id)
//               app/api/track/route.ts (receives visitor_id)
// ============================================

/**
 * Cookie name for the persistent visitor ID.
 * Format: UUIDv4, generated client-side.
 */
const VISITOR_COOKIE_NAME = "smo_vid";

/** Cookie lifetime: 365 days in seconds */
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Generates a UUIDv4 using the Web Crypto API.
 * No external dependency needed.
 */
function generateUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version (4) and variant (RFC4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Reads a cookie value by name.
 * Returns undefined if the cookie doesn't exist or cookies are unavailable.
 */
function getCookie(name: string): string | undefined {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1] ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sets a cookie with the given name, value, and max-age.
 * SameSite=Lax, path=/, not httpOnly (client-readable).
 */
function setCookie(name: string, value: string, maxAge: number): void {
  try {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    // Cookie setting failed (private mode, blocked cookies) — silent fail
  }
}

/**
 * Gets or creates the persistent visitor ID cookie.
 * If the cookie exists, refreshes its expiry.
 * If missing, generates a new UUIDv4 and sets it.
 *
 * @returns The visitor ID string, or undefined if cookies are unavailable.
 */
export function getOrCreateVisitorId(): string | undefined {
  const existing = getCookie(VISITOR_COOKIE_NAME);
  if (existing) {
    // Refresh expiry on every visit
    setCookie(VISITOR_COOKIE_NAME, existing, COOKIE_MAX_AGE);
    return existing;
  }
  const id = generateUuid();
  setCookie(VISITOR_COOKIE_NAME, id, COOKIE_MAX_AGE);
  return getCookie(VISITOR_COOKIE_NAME) !== undefined ? id : undefined;
}

/**
 * Reads the visitor ID cookie without creating one.
 * Used by signup flow to check if a visitor cookie exists.
 */
export function getVisitorId(): string | undefined {
  return getCookie(VISITOR_COOKIE_NAME);
}
```

**Step 2: Commit**

```bash
git add apps/landing/src/lib/visitor-cookie.ts
git commit -m "feat(landing): add visitor cookie manager (smo_vid)"
```

---

## Task 3: Enhanced Client-Side Tracking Hooks

**Files:**

- Modify: `apps/landing/src/hooks/useTracking.ts`
- Create: `apps/landing/src/hooks/useScrollTracking.ts`
- Create: `apps/landing/src/hooks/useClickTracking.ts`
- Create: `apps/landing/src/hooks/useSessionLifecycle.ts`

### Step 1: Update useTracking.ts to include visitor_id

Modify the existing file. The changes are:

1. Import `getOrCreateVisitorId` from visitor-cookie
2. Add `visitor_id` to the `postEvent` payload type
3. Include `visitor_id` in `usePageTracking` and `useTrackCta`

Replace the full `apps/landing/src/hooks/useTracking.ts` with:

```typescript
// ============================================
// useTracking.ts
// Client-side tracking hooks for the landing page.
// Sends anonymous events to POST /api/track which
// writes them to the landing_event table in Supabase.
//
// Exports:
//   usePageTracking() — fires a page_view event once per browser session
//   useTrackCta()     — returns a trackCta(label) function for CTA clicks
//   postEvent()       — low-level event poster (used by other tracking hooks)
//   getOrCreateSessionId() — session ID accessor (used by other hooks)
//   getCurrentVariant()    — variant accessor (used by other hooks)
//
// Connected to: app/api/track/route.ts (receives events)
//               lib/visitor-cookie.ts (persistent visitor ID)
// ============================================

"use client";

import { useEffect, useCallback } from "react";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/** Key in sessionStorage — set once per browser session to avoid duplicates. */
const SESSION_TRACKED_KEY = "smartout_page_tracked";

/** Key in sessionStorage — the anonymous session ID for this browser tab. */
const SESSION_ID_KEY = "smartout_session_id";

/** Key in localStorage — matches the variant store in landing-variant.ts. */
const VARIANT_STORAGE_KEY = "landing_variant";

/**
 * Generates a random session ID using the Web Crypto API.
 * Format: 16 hex bytes = 32 char string.
 */
function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Reads or creates the anonymous session ID from sessionStorage.
 * The same ID is reused across all events in a single browser tab session.
 */
export function getOrCreateSessionId(): string {
  const existing = getSessionStorageItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = generateSessionId();
  setSessionStorageItem(SESSION_ID_KEY, id);
  return id;
}

function getSessionStorageItem(key: string): string | undefined {
  try {
    return sessionStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function setSessionStorageItem(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Returns the currently active landing variant, or undefined if not set. */
export function getCurrentVariant(): string | undefined {
  try {
    return localStorage.getItem(VARIANT_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Posts a tracking event to the server-side /api/track route.
 * Fire-and-forget — errors are silently swallowed.
 */
export async function postEvent(payload: {
  event_type: string;
  variant?: string;
  session_id?: string;
  visitor_id?: string;
  referrer?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Tracking errors must never reach the user
  }
}

/**
 * Sends a tracking event via navigator.sendBeacon (for unload events).
 * Returns true if the beacon was queued successfully.
 */
export function beaconEvent(payload: {
  event_type: string;
  variant?: string;
  session_id?: string;
  visitor_id?: string;
  details?: Record<string, unknown>;
}): boolean {
  try {
    return navigator.sendBeacon(
      "/api/track",
      new Blob([JSON.stringify(payload)], { type: "application/json" }),
    );
  } catch {
    return false;
  }
}

/**
 * Fires a single page_view event once per browser session.
 * Now includes visitor_id from the persistent cookie.
 */
export function usePageTracking(): void {
  useEffect(() => {
    if (getSessionStorageItem(SESSION_TRACKED_KEY)) return;
    setSessionStorageItem(SESSION_TRACKED_KEY, "1");

    const session_id = getOrCreateSessionId();
    const visitor_id = getOrCreateVisitorId();
    const variant = getCurrentVariant();
    const referrer = document.referrer || undefined;

    void postEvent({
      event_type: "page_view",
      variant,
      session_id,
      visitor_id,
      referrer,
      details: { pathname: window.location.pathname },
    });
  }, []);
}

/**
 * Returns a stable `trackCta(label)` function for CTA click tracking.
 * Now includes visitor_id.
 */
export function useTrackCta(): (label: string) => void {
  return useCallback((label: string) => {
    const session_id = getOrCreateSessionId();
    const visitor_id = getOrCreateVisitorId();
    const variant = getCurrentVariant();

    void postEvent({
      event_type: "cta_click",
      variant,
      session_id,
      visitor_id,
      details: { label },
    });
  }, []);
}
```

### Step 2: Create useScrollTracking.ts

```typescript
// ============================================
// useScrollTracking.ts
// Tracks scroll depth at 25%, 50%, 75%, 100% thresholds.
// Each threshold fires once per session (guarded by sessionStorage).
//
// Connected to: useTracking.ts (postEvent, getOrCreateSessionId)
//               lib/visitor-cookie.ts (visitor ID)
// ============================================

"use client";

import { useEffect } from "react";
import { postEvent, getOrCreateSessionId, getCurrentVariant } from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

const SCROLL_THRESHOLDS = [25, 50, 75, 100] as const;
const SCROLL_TRACKED_PREFIX = "smartout_scroll_";

function getScrollPercent(): number {
  const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  if (docHeight <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / docHeight) * 100));
}

function isThresholdTracked(threshold: number): boolean {
  try {
    return sessionStorage.getItem(`${SCROLL_TRACKED_PREFIX}${threshold}`) === "1";
  } catch {
    return true; // If storage unavailable, skip tracking
  }
}

function markThresholdTracked(threshold: number): void {
  try {
    sessionStorage.setItem(`${SCROLL_TRACKED_PREFIX}${threshold}`, "1");
  } catch {
    // Silent fail
  }
}

/**
 * Tracks scroll depth at 25/50/75/100% thresholds.
 * Each threshold fires exactly once per browser tab session.
 */
export function useScrollTracking(): void {
  useEffect(() => {
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const percent = getScrollPercent();

        for (const threshold of SCROLL_THRESHOLDS) {
          if (percent >= threshold && !isThresholdTracked(threshold)) {
            markThresholdTracked(threshold);

            const session_id = getOrCreateSessionId();
            const visitor_id = getOrCreateVisitorId();
            const variant = getCurrentVariant();

            void postEvent({
              event_type: "scroll_depth",
              session_id,
              visitor_id,
              variant,
              details: { percent: threshold },
            });
          }
        }

        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    // Check initial position (page might load already scrolled)
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}
```

### Step 3: Create useClickTracking.ts

```typescript
// ============================================
// useClickTracking.ts
// Tracks all clicks on the page with element info.
// Captures: tagName, text content, href, CSS selector path,
// click position (x, y).
//
// Debounced: max 1 event per 200ms to avoid flooding.
//
// Connected to: useTracking.ts (postEvent, getOrCreateSessionId)
//               lib/visitor-cookie.ts (visitor ID)
// ============================================

"use client";

import { useEffect } from "react";
import { postEvent, getOrCreateSessionId, getCurrentVariant } from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/**
 * Builds a short CSS selector path for an element.
 * Example: "header > nav > a.cta-button"
 * Limited to 3 ancestors to keep it readable.
 */
function getSelectorPath(el: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;

  while (current && depth < 3) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === "string") {
      const classes = current.className
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("__") && c.length < 30)
        .slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join(".")}`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return parts.join(" > ");
}

/**
 * Finds the nearest interactive element (a, button, [role=button], input, select).
 * Falls back to the clicked element itself.
 */
function findInteractiveElement(el: HTMLElement): HTMLElement {
  const interactive = el.closest("a, button, [role='button'], input, select, [data-track]");
  return (interactive as HTMLElement) ?? el;
}

/**
 * Tracks all document clicks with element metadata.
 * Debounced at 200ms to prevent flooding during rapid clicks.
 */
export function useClickTracking(): void {
  useEffect(() => {
    let lastClickTime = 0;

    function onClick(e: MouseEvent) {
      const now = Date.now();
      if (now - lastClickTime < 200) return;
      lastClickTime = now;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const el = findInteractiveElement(target);
      const tagName = el.tagName.toLowerCase();
      const text = (el.textContent ?? "").trim().slice(0, 100);
      const href = el instanceof HTMLAnchorElement ? el.href : undefined;
      const selector = getSelectorPath(el);

      const session_id = getOrCreateSessionId();
      const visitor_id = getOrCreateVisitorId();
      const variant = getCurrentVariant();

      void postEvent({
        event_type: "click",
        session_id,
        visitor_id,
        variant,
        details: {
          selector,
          text: text || undefined,
          href: href || undefined,
          tagName,
          x: Math.round(e.clientX),
          y: Math.round(e.clientY),
        },
      });
    }

    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
}
```

### Step 4: Create useSessionLifecycle.ts

```typescript
// ============================================
// useSessionLifecycle.ts
// Manages session heartbeat (every 30s) and session end
// (beforeunload / visibilitychange hidden).
//
// Heartbeat keeps session.ended_at fresh server-side.
// Session end sends final summary via navigator.sendBeacon.
//
// Connected to: useTracking.ts (postEvent, beaconEvent, getOrCreateSessionId)
//               lib/visitor-cookie.ts (visitor ID)
// ============================================

"use client";

import { useEffect, useRef } from "react";
import { postEvent, beaconEvent, getOrCreateSessionId, getCurrentVariant } from "./useTracking";
import { getOrCreateVisitorId } from "../lib/visitor-cookie";

/** Heartbeat interval in milliseconds */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Manages session lifecycle:
 * - Sends heartbeat every 30s with timeOnPage + scrollPercent
 * - Sends session_end on page unload via sendBeacon
 */
export function useSessionLifecycle(): void {
  const startTime = useRef(Date.now());
  const clickCount = useRef(0);
  const maxScroll = useRef(0);
  const pageCount = useRef(1);

  useEffect(() => {
    const session_id = getOrCreateSessionId();
    const visitor_id = getOrCreateVisitorId();
    const variant = getCurrentVariant();

    // Track scroll max for session summary
    function onScroll() {
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) {
        maxScroll.current = 100;
        return;
      }
      const percent = Math.min(100, Math.round((window.scrollY / docHeight) * 100));
      if (percent > maxScroll.current) {
        maxScroll.current = percent;
      }
    }

    // Track clicks for session summary
    function onClick() {
      clickCount.current++;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, { capture: true, passive: true });

    // Heartbeat: send current state every 30s
    const heartbeatInterval = setInterval(() => {
      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000);
      void postEvent({
        event_type: "session_heartbeat",
        session_id,
        visitor_id,
        variant,
        details: {
          timeOnPage,
          scrollPercent: maxScroll.current,
        },
      });
    }, HEARTBEAT_INTERVAL_MS);

    // Session end: fire on page unload or visibility hidden
    function sendSessionEnd() {
      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000);
      beaconEvent({
        event_type: "session_end",
        session_id,
        visitor_id,
        variant,
        details: {
          timeOnPage,
          maxScroll: maxScroll.current,
          clickCount: clickCount.current,
          pageCount: pageCount.current,
        },
      });
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        sendSessionEnd();
      }
    }

    // visibilitychange is more reliable than beforeunload on mobile
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", sendSessionEnd);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", sendSessionEnd);
    };
  }, []);
}
```

### Step 5: Commit

```bash
git add apps/landing/src/hooks/useTracking.ts apps/landing/src/hooks/useScrollTracking.ts apps/landing/src/hooks/useClickTracking.ts apps/landing/src/hooks/useSessionLifecycle.ts
git commit -m "feat(landing): add scroll, click, and session lifecycle tracking hooks"
```

---

## Task 4: Enhanced /api/track Endpoint

**Files:**

- Modify: `apps/landing/src/app/api/track/route.ts`

### Step 1: Rewrite the track route

Replace `apps/landing/src/app/api/track/route.ts` with the enhanced version that handles new event types and upserts visitor/session records.

```typescript
// ============================================
// track/route.ts
// Public endpoint for logging anonymous landing page events.
// Handles: page_view, cta_click, voice_session_started,
//          click, scroll_depth, session_heartbeat, session_end.
//
// On events with visitor_id:
//   - UPSERTs landing_visitor (create on first visit, update last_seen)
//   - UPSERTs landing_session (create on first event, update aggregates)
//
// No auth required — public, write-only endpoint.
// Connected to: apps/landing/src/hooks/*.ts (client calls)
//               apps/web/src/app/platform-admin/landing/ (reads data)
// ============================================

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import type { Json } from "@smartout/supabase";

const TrackEventSchema = z.object({
  event_type: z.enum([
    "page_view",
    "voice_session_started",
    "cta_click",
    "click",
    "scroll_depth",
    "session_heartbeat",
    "session_end",
  ]),
  variant: z.string().optional(),
  session_id: z.string().optional(),
  visitor_id: z.string().uuid().optional(),
  referrer: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

function getIpAddress(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const forwardedIp = forwarded.split(",")[0]?.trim();
    return forwardedIp === "" ? null : (forwardedIp ?? null);
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp === "" ? null : (realIp ?? null);
}

/**
 * Detects device type from User-Agent string.
 * Simple regex — no library needed.
 */
function detectDeviceType(ua: string | null): string {
  if (!ua) return "desktop";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(lower)) return "mobile";
  return "desktop";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = TrackEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event data" }, { status: 400 });
  }

  const { event_type, variant, session_id, visitor_id, referrer, details } = parsed.data;
  const ip_address = getIpAddress(request);
  const user_agent = request.headers.get("user-agent");

  try {
    const admin = createAdminClient();

    // 1. Insert the event
    const { error: eventError } = await admin.from("landing_event").insert({
      event_type,
      variant: variant ?? null,
      session_id: session_id ?? null,
      visitor_id: visitor_id ?? null,
      referrer: referrer ?? null,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      details: (details ?? {}) as unknown as Json,
    });

    if (eventError) {
      console.error("[track] Event insert failed:", eventError.message);
    }

    // 2. Upsert visitor (if visitor_id provided)
    if (visitor_id) {
      const ipArr = ip_address ? [ip_address] : [];
      const uaArr = user_agent ? [user_agent] : [];

      const { error: visitorError } = await admin.rpc(
        "upsert_landing_visitor" as never,
        {
          p_id: visitor_id,
          p_referrer: referrer ?? null,
          p_variant: variant ?? null,
          p_ip: ip_address ?? null,
          p_ua: user_agent ?? null,
        } as never,
      );

      // Fallback if RPC doesn't exist yet: direct upsert
      if (visitorError) {
        await admin
          .from("landing_visitor")
          .upsert(
            {
              id: visitor_id,
              first_referrer: referrer ?? null,
              first_variant: variant ?? null,
              ip_addresses: ipArr,
              user_agents: uaArr,
              last_seen: new Date().toISOString(),
            },
            { onConflict: "id" },
          )
          .select("id")
          .single();
      }
    }

    // 3. Upsert session (if session_id and visitor_id provided)
    if (session_id && visitor_id) {
      const device_type = detectDeviceType(user_agent);
      const isPageView = event_type === "page_view";
      const isClick = event_type === "click";
      const isCtaClick = event_type === "cta_click";
      const isScrollDepth = event_type === "scroll_depth";
      const isSessionEnd = event_type === "session_end";
      const scrollPercent =
        isScrollDepth && details && typeof details.percent === "number"
          ? details.percent
          : undefined;
      const endTimeOnPage =
        isSessionEnd && details && typeof details.timeOnPage === "number"
          ? details.timeOnPage
          : undefined;

      // Try to get existing session
      const { data: existingSession } = await admin
        .from("landing_session")
        .select("id, page_count, click_count, cta_click_count, max_scroll_depth, started_at")
        .eq("session_id", session_id)
        .single();

      if (existingSession) {
        // Update existing session
        const updates: Record<string, unknown> = {
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (isPageView) updates.page_count = existingSession.page_count + 1;
        if (isClick) updates.click_count = existingSession.click_count + 1;
        if (isCtaClick) updates.cta_click_count = existingSession.cta_click_count + 1;
        if (scrollPercent !== undefined && scrollPercent > existingSession.max_scroll_depth) {
          updates.max_scroll_depth = scrollPercent;
        }
        if (endTimeOnPage !== undefined) {
          updates.duration_seconds = endTimeOnPage;
        } else {
          // Calculate duration from started_at
          const started = new Date(existingSession.started_at).getTime();
          updates.duration_seconds = Math.round((Date.now() - started) / 1000);
        }

        await admin.from("landing_session").update(updates).eq("id", existingSession.id);
      } else {
        // Create new session
        await admin.from("landing_session").insert({
          visitor_id,
          session_id,
          variant: variant ?? null,
          referrer: referrer ?? null,
          ip_address: ip_address ?? null,
          user_agent: user_agent ?? null,
          device_type,
          page_count: isPageView ? 1 : 0,
          click_count: isClick ? 1 : 0,
          cta_click_count: isCtaClick ? 1 : 0,
          max_scroll_depth: scrollPercent ?? 0,
        });

        // Increment visitor visit_count
        await admin
          .rpc(
            "increment_visitor_count" as never,
            {
              p_visitor_id: visitor_id,
            } as never,
          )
          .then(() => {
            // Fallback handled below
          })
          .catch(async () => {
            // RPC doesn't exist yet — manual increment
            const { data: v } = await admin
              .from("landing_visitor")
              .select("visit_count")
              .eq("id", visitor_id)
              .single();
            if (v) {
              await admin
                .from("landing_visitor")
                .update({ visit_count: v.visit_count + 1, last_seen: new Date().toISOString() })
                .eq("id", visitor_id);
            }
          });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("[track] Error:", err);
    return NextResponse.json({ ok: false });
  }
}
```

**Note:** The RPC functions (`upsert_landing_visitor`, `increment_visitor_count`) are optional optimizations. The code falls back to direct queries if they don't exist. We can add them later as a performance optimization if event volume warrants it.

### Step 2: Commit

```bash
git add apps/landing/src/app/api/track/route.ts
git commit -m "feat(landing): enhance /api/track with visitor/session upsert and new event types"
```

---

## Task 5: Wire Up Tracking in Landing Page Components

**Files:**

- Modify: `apps/landing/src/components/tracking.tsx`

### Step 1: Add a FullTracker component

Add a `FullTracker` component to `tracking.tsx` that bundles all tracking hooks. This replaces `PageTracker` as the primary tracking entry point.

Add after the existing `TrackedCta` component:

```typescript
import { useScrollTracking } from "../hooks/useScrollTracking";
import { useClickTracking } from "../hooks/useClickTracking";
import { useSessionLifecycle } from "../hooks/useSessionLifecycle";

/**
 * Full tracking component: page views + scroll depth + clicks + session lifecycle.
 * Drop this once into the root layout or top-level page.
 * Renders nothing — zero layout impact.
 */
export function FullTracker() {
  usePageTracking();
  useScrollTracking();
  useClickTracking();
  useSessionLifecycle();
  return null;
}
```

Then update the landing page entry points to use `FullTracker` instead of `PageTracker`. Find all files that import `PageTracker`:

Run: `cd /home/sxtnl/dev/wt-6 && grep -rl "PageTracker" apps/landing/src/`

Replace `<PageTracker />` with `<FullTracker />` in each file, and update the import from `"../../components/tracking"` (or relative path) to include `FullTracker`.

**Important:** Keep `PageTracker` exported for backward compatibility — other pages that only need page views can still use it.

### Step 2: Commit

```bash
git add apps/landing/src/components/tracking.tsx
# Also add any files where PageTracker was replaced with FullTracker
git commit -m "feat(landing): wire up full tracking (scroll, clicks, session) in landing pages"
```

---

## Task 6: Admin Dashboard — Sessions Tab Server Data

**Files:**

- Modify: `apps/web/src/app/platform-admin/landing/page.tsx`

### Step 1: Extend the server component to fetch session data

The page.tsx needs to fetch:

1. All existing event data (keep as-is)
2. Recent sessions from `landing_session` joined with `landing_visitor`
3. Session KPIs: unique visitors today, returning visitors (7d), avg duration, avg scroll

Replace the full `page.tsx`:

```typescript
// ============================================
// platform-admin/landing/page.tsx
// Server component: fetches landing events AND session data.
// Renders tabbed view: Events | Sessions.
//
// Connected to: _components/landing-tabs.tsx (tab container)
//               _components/landing-activity-client.tsx (events tab)
//               _components/sessions-tab.tsx (sessions tab)
// ============================================

import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";
import { redirect } from "next/navigation";
import { LandingTabs } from "./_components/landing-tabs";
import type { LandingEventRow } from "./_components/landing-columns";

function todayUtcStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function sevenDaysAgoUtcStart(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export type SessionRow = {
  id: string;
  visitor_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  max_scroll_depth: number;
  page_count: number;
  click_count: number;
  cta_click_count: number;
  variant: string | null;
  referrer: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  // Joined from landing_visitor
  visitor: {
    id: string;
    visit_count: number;
    first_seen: string;
    user_identity_id: string | null;
    manual_label: string | null;
    // Joined from user_identity (if linked)
    user_identity: {
      full_name: string | null;
      email: string | null;
    } | null;
  } | null;
};

export default async function LandingActivityPage() {
  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  const admin = createAdminClient();
  const today = todayUtcStart();
  const sevenDaysAgo = sevenDaysAgoUtcStart();

  const [
    { data: events },
    { count: visitsToday },
    { count: voiceSessionsToday },
    { count: ctaClicksToday },
    { data: recentSessions },
    { data: sessionsForKpi },
    { data: recentVisitorSessions },
    { data: returningVisitors },
  ] = await Promise.all([
    // Events tab data (existing)
    admin
      .from("landing_event")
      .select("id, event_type, variant, session_id, referrer, ip_address, user_agent, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200),

    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .gte("created_at", today),

    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "voice_session_started")
      .gte("created_at", today),

    admin
      .from("landing_event")
      .select("*", { count: "exact", head: true })
      .eq("event_type", "cta_click")
      .gte("created_at", today),

    // Sessions tab data
    admin
      .from("landing_session")
      .select(`
        id, visitor_id, session_id, started_at, ended_at, duration_seconds,
        max_scroll_depth, page_count, click_count, cta_click_count,
        variant, referrer, ip_address, user_agent, device_type,
        visitor:landing_visitor!inner(
          id, visit_count, first_seen, user_identity_id, manual_label,
          user_identity:user_identity(full_name, email)
        )
      `)
      .order("started_at", { ascending: false })
      .limit(200),

    // Session KPIs: avg duration + avg scroll for today's sessions
    admin
      .from("landing_session")
      .select("duration_seconds, max_scroll_depth")
      .gte("started_at", today),

    // Unique session IDs for 7d (existing, for events tab)
    admin
      .from("landing_event")
      .select("session_id")
      .not("session_id", "is", null)
      .gte("created_at", sevenDaysAgo),

    // Returning visitors (7d): visitors with visit_count > 1 who had sessions this week
    admin
      .from("landing_session")
      .select("visitor_id, visitor:landing_visitor!inner(visit_count)")
      .gte("started_at", sevenDaysAgo),
  ]);

  const uniqueSessions7d = new Set(
    (recentVisitorSessions ?? []).map((r) => r.session_id).filter(Boolean),
  ).size;

  // Session KPIs
  const todaySessions = sessionsForKpi ?? [];
  const uniqueVisitorsToday = new Set(
    (recentSessions ?? [])
      .filter((s) => new Date(s.started_at) >= new Date(today))
      .map((s) => s.visitor_id),
  ).size;

  const returningCount = new Set(
    (returningVisitors ?? [])
      .filter((r) => {
        const v = r.visitor as unknown as { visit_count: number } | null;
        return v && v.visit_count > 1;
      })
      .map((r) => r.visitor_id),
  ).size;

  const avgDuration =
    todaySessions.length > 0
      ? Math.round(
          todaySessions.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0) /
            todaySessions.length,
        )
      : 0;

  const avgScroll =
    todaySessions.length > 0
      ? Math.round(
          todaySessions.reduce((sum, s) => sum + (s.max_scroll_depth ?? 0), 0) /
            todaySessions.length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Landing Activity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Visitor tracking, session analytics, and CTA performance
        </p>
      </div>

      <LandingTabs
        events={(events as unknown as LandingEventRow[]) ?? []}
        visitsToday={visitsToday ?? 0}
        voiceSessionsToday={voiceSessionsToday ?? 0}
        ctaClicksToday={ctaClicksToday ?? 0}
        uniqueSessions7d={uniqueSessions7d}
        sessions={(recentSessions as unknown as SessionRow[]) ?? []}
        uniqueVisitorsToday={uniqueVisitorsToday}
        returningVisitors7d={returningCount}
        avgDurationToday={avgDuration}
        avgScrollToday={avgScroll}
      />
    </div>
  );
}
```

### Step 2: Commit

```bash
git add apps/web/src/app/platform-admin/landing/page.tsx
git commit -m "feat(admin): extend landing page.tsx with session data fetching and KPIs"
```

---

## Task 7: Admin Dashboard — Tab Container + Sessions Tab

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/_components/landing-tabs.tsx`
- Create: `apps/web/src/app/platform-admin/landing/_components/sessions-tab.tsx`
- Create: `apps/web/src/app/platform-admin/landing/_components/session-columns.tsx`

### Step 1: Create landing-tabs.tsx

This wraps both the existing events tab and the new sessions tab.

```typescript
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LandingActivityClient } from "./landing-activity-client";
import { SessionsTab } from "./sessions-tab";
import type { LandingEventRow } from "./landing-columns";
import type { SessionRow } from "../page";

type LandingTabsProps = {
  // Events tab
  events: LandingEventRow[];
  visitsToday: number;
  voiceSessionsToday: number;
  ctaClicksToday: number;
  uniqueSessions7d: number;
  // Sessions tab
  sessions: SessionRow[];
  uniqueVisitorsToday: number;
  returningVisitors7d: number;
  avgDurationToday: number;
  avgScrollToday: number;
};

export function LandingTabs({
  events,
  visitsToday,
  voiceSessionsToday,
  ctaClicksToday,
  uniqueSessions7d,
  sessions,
  uniqueVisitorsToday,
  returningVisitors7d,
  avgDurationToday,
  avgScrollToday,
}: LandingTabsProps) {
  return (
    <Tabs defaultValue="sessions" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
      </TabsList>

      <TabsContent value="sessions">
        <SessionsTab
          sessions={sessions}
          uniqueVisitorsToday={uniqueVisitorsToday}
          returningVisitors7d={returningVisitors7d}
          avgDurationToday={avgDurationToday}
          avgScrollToday={avgScrollToday}
        />
      </TabsContent>

      <TabsContent value="events">
        <LandingActivityClient
          events={events}
          visitsToday={visitsToday}
          voiceSessionsToday={voiceSessionsToday}
          ctaClicksToday={ctaClicksToday}
          uniqueSessions7d={uniqueSessions7d}
        />
      </TabsContent>
    </Tabs>
  );
}
```

### Step 2: Create session-columns.tsx

```typescript
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { SessionRow } from "../page";
import {
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getVisitorLabel(session: SessionRow): { label: string; type: "identified" | "tagged" | "returning" | "anonymous" } {
  const visitor = session.visitor;
  if (visitor?.user_identity_id && visitor.user_identity) {
    return {
      label: visitor.user_identity.full_name ?? visitor.user_identity.email ?? "Linked user",
      type: "identified",
    };
  }
  if (visitor?.manual_label) {
    return { label: visitor.manual_label, type: "tagged" };
  }
  if (visitor && visitor.visit_count > 1) {
    return { label: session.visitor_id.slice(0, 8), type: "returning" };
  }
  return { label: session.visitor_id.slice(0, 8), type: "anonymous" };
}

const badgeStyles: Record<string, string> = {
  identified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  tagged: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  returning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  anonymous: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const DeviceIcon = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

export const sessionColumns: ColumnDef<SessionRow>[] = [
  {
    id: "visitor",
    header: "Visitor",
    cell: ({ row }) => {
      const { label, type } = getVisitorLabel(row.original);
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{label}</span>
          <Badge variant="outline" className={`text-[10px] ${badgeStyles[type]}`}>
            {type}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "variant",
    header: "Variant",
    cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return v ? (
        <span className="font-mono text-xs font-medium">{v}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "duration_seconds",
    header: "Duration",
    cell: ({ getValue }) => (
      <span className="text-xs">{formatDuration(getValue() as number | null)}</span>
    ),
  },
  {
    accessorKey: "max_scroll_depth",
    header: "Scroll",
    cell: ({ getValue }) => {
      const depth = getValue() as number;
      return (
        <div className="flex items-center gap-2">
          <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-blue-500"
              style={{ width: `${depth}%` }}
            />
          </div>
          <span className="text-muted-foreground text-xs">{depth}%</span>
        </div>
      );
    },
  },
  {
    accessorKey: "click_count",
    header: "Clicks",
    cell: ({ getValue }) => <span className="text-xs">{getValue() as number}</span>,
  },
  {
    accessorKey: "page_count",
    header: "Pages",
    cell: ({ getValue }) => <span className="text-xs">{getValue() as number}</span>,
  },
  {
    id: "device",
    header: "Device",
    cell: ({ row }) => {
      const type = (row.original.device_type ?? "desktop") as keyof typeof DeviceIcon;
      const Icon = DeviceIcon[type] ?? Monitor;
      return <Icon className="text-muted-foreground h-4 w-4" />;
    },
  },
  {
    accessorKey: "started_at",
    header: "Time",
    cell: ({ getValue }) => {
      const date = new Date(getValue() as string);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return <span className="text-xs">just now</span>;
      if (diffMins < 60) return <span className="text-xs">{diffMins}m ago</span>;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return <span className="text-xs">{diffHours}h ago</span>;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return <span className="text-xs">{diffDays}d ago</span>;
      return (
        <span className="text-xs">
          {date.toLocaleDateString("no-NO", { dateStyle: "short" })}
        </span>
      );
    },
  },
];
```

### Step 3: Create sessions-tab.tsx

```typescript
"use client";

import { useState } from "react";
import { Users, UserCheck, Clock, ArrowDownToLine } from "lucide-react";
import { KpiCard } from "@/components/platform-admin/kpi-card";
import { DataTable } from "@/components/platform-admin/data-table";
import { sessionColumns } from "./session-columns";
import { SessionDetail } from "./session-detail";
import type { SessionRow } from "../page";

type SessionsTabProps = {
  sessions: SessionRow[];
  uniqueVisitorsToday: number;
  returningVisitors7d: number;
  avgDurationToday: number;
  avgScrollToday: number;
};

function formatAvgDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function SessionsTab({
  sessions,
  uniqueVisitorsToday,
  returningVisitors7d,
  avgDurationToday,
  avgScrollToday,
}: SessionsTabProps) {
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Unique visitors today" value={uniqueVisitorsToday} icon={Users} />
          <KpiCard label="Returning visitors (7d)" value={returningVisitors7d} icon={UserCheck} />
          <KpiCard label="Avg. duration today" value={formatAvgDuration(avgDurationToday)} icon={Clock} />
          <KpiCard label="Avg. scroll depth" value={`${avgScrollToday}%`} icon={ArrowDownToLine} />
        </div>

        <DataTable
          columns={sessionColumns}
          data={sessions}
          onRowClick={(session) => setSelectedSession(session)}
        />
      </div>

      <SessionDetail
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </>
  );
}
```

### Step 4: Commit

```bash
git add apps/web/src/app/platform-admin/landing/_components/landing-tabs.tsx apps/web/src/app/platform-admin/landing/_components/sessions-tab.tsx apps/web/src/app/platform-admin/landing/_components/session-columns.tsx
git commit -m "feat(admin): add sessions tab with KPIs, session table, and column definitions"
```

---

## Task 8: Admin Dashboard — Session Detail Sheet

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/_components/session-detail.tsx`

### Step 1: Create the session detail sheet

This is a slide-over panel that shows visitor info and a full event timeline for a selected session.

```typescript
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  MousePointerClick,
  ArrowDownToLine,
  Clock,
  Eye,
  Tag,
  User,
  Activity,
} from "lucide-react";
import type { SessionRow } from "../page";

type SessionDetailProps = {
  session: SessionRow | null;
  onClose: () => void;
};

type TimelineEvent = {
  id: string;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

const eventIcons: Record<string, typeof Globe> = {
  page_view: Eye,
  click: MousePointerClick,
  cta_click: MousePointerClick,
  scroll_depth: ArrowDownToLine,
  session_heartbeat: Activity,
  session_end: Clock,
  voice_session_started: Globe,
};

const eventBadgeStyles: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  click: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  cta_click: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  scroll_depth: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  session_heartbeat: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  session_end: "bg-red-500/10 text-red-400 border-red-500/20",
  voice_session_started: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};

function formatEventDetail(event: TimelineEvent): string {
  const d = event.details;
  if (!d) return "";

  switch (event.event_type) {
    case "click":
      return [d.text, d.href].filter(Boolean).join(" → ") || (d.selector as string) || "";
    case "cta_click":
      return (d.label as string) ?? "";
    case "scroll_depth":
      return `${d.percent}%`;
    case "session_heartbeat":
      return `${d.timeOnPage}s on page`;
    case "session_end":
      return `${d.timeOnPage}s total, ${d.maxScroll}% scroll, ${d.clickCount} clicks`;
    case "page_view":
      return (d.pathname as string) ?? "";
    case "voice_session_started":
      return (d.mission as string) ?? "";
    default:
      return "";
  }
}

const DeviceIcon = { desktop: Monitor, mobile: Smartphone, tablet: Tablet } as const;

export function SessionDetail({ session, onClose }: SessionDetailProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session) {
      setEvents([]);
      return;
    }

    setLoading(true);
    // Fetch events for this session via the admin API
    fetch(`/api/admin/session-events?session_id=${encodeURIComponent(session.session_id)}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events ?? []);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [session]);

  const visitor = session?.visitor;
  const deviceType = (session?.device_type ?? "desktop") as keyof typeof DeviceIcon;
  const DevIcon = DeviceIcon[deviceType] ?? Monitor;

  return (
    <Sheet open={!!session} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
        {session && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <DevIcon className="h-4 w-4" />
                Session Detail
              </SheetTitle>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Visitor info */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Visitor
                </h3>
                <div className="bg-muted/50 space-y-2 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">ID</span>
                    <span className="font-mono text-xs">{session.visitor_id.slice(0, 12)}...</span>
                  </div>
                  {visitor?.user_identity_id && visitor.user_identity && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        <User className="mr-1 inline h-3 w-3" />
                        Identity
                      </span>
                      <span className="text-xs">
                        {visitor.user_identity.full_name ?? visitor.user_identity.email}
                      </span>
                    </div>
                  )}
                  {visitor?.manual_label && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        <Tag className="mr-1 inline h-3 w-3" />
                        Tag
                      </span>
                      <span className="text-xs">{visitor.manual_label}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Visits</span>
                    <span className="text-xs">{visitor?.visit_count ?? 1}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Device</span>
                    <span className="text-xs capitalize">{session.device_type ?? "desktop"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">IP</span>
                    <span className="font-mono text-xs">{session.ip_address ?? "—"}</span>
                  </div>
                </div>
              </div>

              {/* Session summary */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Summary
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold">
                      {session.duration_seconds
                        ? `${Math.floor(session.duration_seconds / 60)}:${String(session.duration_seconds % 60).padStart(2, "0")}`
                        : "—"}
                    </div>
                    <div className="text-muted-foreground text-[10px] uppercase">Duration</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold">{session.max_scroll_depth}%</div>
                    <div className="text-muted-foreground text-[10px] uppercase">Scroll</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold">{session.click_count}</div>
                    <div className="text-muted-foreground text-[10px] uppercase">Clicks</div>
                  </div>
                </div>

                {/* Scroll progress bar */}
                <div>
                  <div className="text-muted-foreground mb-1 text-xs">Scroll progress</div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${session.max_scroll_depth}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Event timeline */}
              <div className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  Timeline ({events.length} events)
                </h3>
                {loading ? (
                  <div className="text-muted-foreground py-8 text-center text-sm">Loading events...</div>
                ) : events.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center text-sm">No events found</div>
                ) : (
                  <div className="space-y-1">
                    {events.map((event) => {
                      const Icon = eventIcons[event.event_type] ?? Globe;
                      const detail = formatEventDetail(event);
                      const time = new Date(event.created_at).toLocaleTimeString("no-NO", {
                        timeStyle: "medium",
                      });

                      return (
                        <div
                          key={event.id}
                          className="hover:bg-muted/50 flex items-start gap-3 rounded-md px-2 py-1.5"
                        >
                          <Icon className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${eventBadgeStyles[event.event_type] ?? ""}`}
                              >
                                {event.event_type.replace(/_/g, " ")}
                              </Badge>
                              <span className="text-muted-foreground text-[10px]">{time}</span>
                            </div>
                            {detail && (
                              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                {detail}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### Step 2: Commit

```bash
git add apps/web/src/app/platform-admin/landing/_components/session-detail.tsx
git commit -m "feat(admin): add session detail sheet with visitor info, summary, and event timeline"
```

---

## Task 9: Session Events API Route (for detail sheet)

**Files:**

- Create: `apps/web/src/app/api/admin/session-events/route.ts`

### Step 1: Create the API route

The session detail sheet needs to fetch events for a specific session_id. This route is authenticated (platform admin only).

```typescript
// ============================================
// api/admin/session-events/route.ts
// Fetches all landing_event rows for a given session_id.
// Platform admin only (service role, godmode check).
//
// Connected to: platform-admin/landing/_components/session-detail.tsx
// ============================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

export async function GET(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("landing_event")
    .select("id, event_type, details, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data ?? [] });
}
```

### Step 2: Commit

```bash
git add apps/web/src/app/api/admin/session-events/route.ts
git commit -m "feat(admin): add session-events API route for session detail timeline"
```

---

## Task 10: Visitor Tag Dialog

**Files:**

- Create: `apps/web/src/app/platform-admin/landing/_components/visitor-tag-dialog.tsx`

### Step 1: Create the tag dialog

Add a dialog that lets admins manually tag a visitor with a label and notes. Wire it into the session detail sheet.

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type VisitorTagDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitorId: string;
  currentLabel?: string | null;
  currentNotes?: string | null;
};

export function VisitorTagDialog({
  open,
  onOpenChange,
  visitorId,
  currentLabel,
  currentNotes,
}: VisitorTagDialogProps) {
  const [label, setLabel] = useState(currentLabel ?? "");
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/admin/tag-visitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitor_id: visitorId, label, notes }),
      });
      onOpenChange(false);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tag Visitor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              placeholder="e.g., Johan, Restaurang Nemo"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!label.trim() || saving}>
            {saving ? "Saving..." : "Save Tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: Create the tag-visitor API route

Create `apps/web/src/app/api/admin/tag-visitor/route.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@smartout/supabase/admin";
import { getSuperAdminId } from "@/lib/platform-admin";

const TagSchema = z.object({
  visitor_id: z.string().uuid(),
  label: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export async function POST(request: NextRequest) {
  const adminId = await getSuperAdminId();
  if (!adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  const { visitor_id, label, notes } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin
    .from("landing_visitor")
    .update({
      manual_label: label,
      manual_notes: notes ?? null,
      tagged_by: adminId,
      tagged_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitor_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

### Step 3: Wire the tag dialog into session-detail.tsx

Add a "Tag visitor" button in the visitor info section of `session-detail.tsx`:

After the visitor info `</div>`, add:

```tsx
{
  !visitor?.user_identity_id && (
    <Button variant="outline" size="sm" className="w-full" onClick={() => setTagDialogOpen(true)}>
      <Tag className="mr-2 h-3 w-3" />
      {visitor?.manual_label ? "Edit Tag" : "Tag Visitor"}
    </Button>
  );
}
```

Add state and import the dialog component. This requires modifying session-detail.tsx to include the dialog.

### Step 4: Commit

```bash
git add apps/web/src/app/platform-admin/landing/_components/visitor-tag-dialog.tsx apps/web/src/app/api/admin/tag-visitor/route.ts apps/web/src/app/platform-admin/landing/_components/session-detail.tsx
git commit -m "feat(admin): add visitor manual tagging with dialog and API route"
```

---

## Task 11: Auto-Link Visitor at Signup

**Files:**

- Modify: `apps/landing/src/app/signup/page.tsx`
- Create: `apps/landing/src/components/signup-visitor-linker.tsx`

### Step 1: Create a client component that stores visitor_id for the signup flow

The signup page redirects to the web app's onboarding. We need to pass the visitor_id. The simplest approach: store it in localStorage before redirect so the web app can read it.

Create `apps/landing/src/components/signup-visitor-linker.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { getVisitorId } from "../lib/visitor-cookie";

/**
 * Stores the smo_vid cookie value into localStorage
 * so the web app can read it after signup redirect.
 * The web app's post-signup flow links it to user_identity.
 */
export function SignupVisitorLinker() {
  useEffect(() => {
    const visitorId = getVisitorId();
    if (visitorId) {
      try {
        localStorage.setItem("smo_landing_visitor_id", visitorId);
      } catch {
        // Silent fail
      }
    }
  }, []);
  return null;
}
```

### Step 2: Add the linker to signup page

In `apps/landing/src/app/signup/page.tsx`, add `<SignupVisitorLinker />` alongside `<PageTracker />`:

```tsx
import { SignupVisitorLinker } from "../../components/signup-visitor-linker";
// ... in the JSX:
<PageTracker />
<SignupVisitorLinker />
```

### Step 3: Commit

```bash
git add apps/landing/src/components/signup-visitor-linker.tsx apps/landing/src/app/signup/page.tsx
git commit -m "feat(landing): store visitor_id in localStorage for signup linking"
```

**Note:** The web app side (reading `smo_landing_visitor_id` from localStorage and writing it to `landing_visitor.user_identity_id` post-signup) should be implemented as a follow-up task since it touches the onboarding flow in `apps/web`.

---

## Task 12: Update Landing Event Columns for New Event Types

**Files:**

- Modify: `apps/web/src/app/platform-admin/landing/_components/landing-columns.tsx`

### Step 1: Add new event types to the event colors and labels

Add entries for the new event types so they render correctly in the events tab:

```typescript
const eventColors: Record<string, string> = {
  page_view: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  voice_session_started: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  cta_click: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  click: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  scroll_depth: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  session_heartbeat: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  session_end: "bg-red-500/10 text-red-400 border-red-500/20",
};

const eventLabels: Record<string, string> = {
  page_view: "Page View",
  voice_session_started: "Voice Session",
  cta_click: "CTA Click",
  click: "Click",
  scroll_depth: "Scroll",
  session_heartbeat: "Heartbeat",
  session_end: "Session End",
};
```

Update `formatDetails` to handle new event types:

```typescript
function formatDetails(row: LandingEventRow): string {
  const d = row.details;
  if (!d || typeof d !== "object") return "—";

  switch (row.event_type) {
    case "cta_click":
      return typeof d.label === "string" ? d.label : "—";
    case "voice_session_started": {
      const callId = typeof d.callId === "string" ? d.callId.slice(0, 8) + "…" : null;
      const mission = typeof d.mission === "string" ? d.mission : null;
      return [mission, callId].filter(Boolean).join(" · ") || "—";
    }
    case "click":
      return [d.text, d.tagName].filter(Boolean).join(" · ") || (d.selector as string) || "—";
    case "scroll_depth":
      return typeof d.percent === "number" ? `${d.percent}%` : "—";
    case "session_heartbeat":
      return typeof d.timeOnPage === "number" ? `${d.timeOnPage}s on page` : "—";
    case "session_end":
      return typeof d.timeOnPage === "number" ? `${d.timeOnPage}s total` : "—";
    default:
      return "—";
  }
}
```

### Step 2: Commit

```bash
git add apps/web/src/app/platform-admin/landing/_components/landing-columns.tsx
git commit -m "feat(admin): add new event type badges and detail formatting to events tab"
```

---

## Task 13: Type Check + Build Verification

### Step 1: Run type check

Run: `cd /home/sxtnl/dev/wt-6 && pnpm typecheck`
Expected: No type errors.

### Step 2: Fix any type errors

If `database.types.ts` is out of date:
Run: `npx supabase gen types typescript --local > packages/supabase/src/database.types.ts`

If `SessionRow` type import fails, ensure the export in `page.tsx` is correct.

### Step 3: Run lint

Run: `cd /home/sxtnl/dev/wt-6 && pnpm lint`
Expected: No lint errors.

### Step 4: Run build

Run: `cd /home/sxtnl/dev/wt-6 && pnpm build`
Expected: Clean build for both `apps/web` and `apps/landing`.

### Step 5: Commit any fixes

```bash
git add -A
git commit -m "fix: resolve type and lint issues for landing session tracking"
```

---

## Task 14: Update Documentation

**Files:**

- Modify: `docs/worklogs/WORKLOG-landing-analytics.md`
- Modify: `docs/decisions/0000-decision-log.md`
- Modify: `docs/reference/DATABASE.md` (add new tables)
- Modify: `CLAUDE.md` (add landing_visitor and landing_session to database traps)

### Step 1: Update WORKLOG

Mark tasks as done, update status.

### Step 2: Create ADR for session tracking decisions

Create `docs/decisions/NNNN-landing-session-tracking.md` covering:

- Cookie strategy (strictly necessary, no consent banner)
- All-Supabase storage (no PostHog for landing)
- Full click tracking (all clicks, not just CTAs)
- Session aggregation approach (incremental updates vs. batch)

### Step 3: Update DATABASE.md

Add `landing_visitor` and `landing_session` table documentation.

### Step 4: Commit

```bash
git add docs/
git commit -m "docs: add landing session tracking ADR, update WORKLOG and DATABASE.md"
```

---

## Summary

| Task | Description                      | Files                    |
| ---- | -------------------------------- | ------------------------ |
| 1    | Database migration               | 1 SQL, 1 generated       |
| 2    | Visitor cookie manager           | 1 new TS                 |
| 3    | Client tracking hooks            | 1 modified, 3 new TS     |
| 4    | Enhanced /api/track endpoint     | 1 modified TS            |
| 5    | Wire tracking into landing pages | 1 modified TSX           |
| 6    | Admin page.tsx — session data    | 1 modified TSX           |
| 7    | Sessions tab + columns           | 3 new TSX                |
| 8    | Session detail sheet             | 1 new TSX                |
| 9    | Session events API route         | 1 new TS                 |
| 10   | Visitor tag dialog + API         | 2 new TSX/TS, 1 modified |
| 11   | Auto-link visitor at signup      | 1 new TSX, 1 modified    |
| 12   | Event columns update             | 1 modified TSX           |
| 13   | Type check + build verification  | fixes                    |
| 14   | Documentation                    | docs updates             |

**Total: ~16 new/modified code files + 1 migration + docs**
