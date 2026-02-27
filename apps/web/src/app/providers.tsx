"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, type ReactNode } from "react";
import { env } from "@/env";

export function PHProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const key = env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return;

    posthog.init(key, {
      api_host: "/ingest",
      ui_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      persistence: "localStorage+cookie",
    });
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
