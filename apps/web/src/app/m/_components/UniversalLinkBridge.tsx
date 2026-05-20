"use client";

/**
 * UniversalLinkBridge — shared body for every `/m/*` Universal-Link landing.
 *
 * Per ADR-0021 amendment + ADR-0362 + SMARTOUT_AUTH_DEEPLINK_ARCHITECTURE.md §5,
 * mobile auth redirectTo targets are `https://app.smartout.ai/m/<path>` (Universal
 * Links). When the app is installed, iOS/Android intercept the URL BEFORE this
 * React tree renders → user lands inside the app at a matching native route.
 *
 * When the app is NOT installed (desktop browser, mobile without app), the
 * bridge renders. We:
 *   1. Attempt one scheme-URL relay (`smartout://<path>`) — preserves query+hash.
 *      If the app IS installed but the OS missed the Universal-Link intent
 *      (rare; user opened the link in a webview, etc.), the scheme URL is a
 *      best-effort second try.
 *   2. Render a fallback UI with App Store + Play Store CTAs.
 *
 * Security: bridge does NOT call `exchangeCodeForSession`. PKCE code-verifier
 * lives in the mobile app's SecureStore — only the app can complete the
 * exchange. Re-emitting the URL to `smartout://` is safe because the scheme
 * URL is per-app and not network-routable.
 *
 * Telemetry: emits `auth bridge_relayed` once per mount with `data.surface`
 * + `data.relay_attempted` for cross-device drop-off analytics.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";
import { emit, nonEmpty } from "@smartout/telemetry";

type BridgeSurface =
  | "oauth_callback"
  | "invite_callback"
  | "update_password"
  | "confirm_email"
  | "invite_token";

type Props = {
  /** Stable identifier for telemetry + analytics. */
  surface: BridgeSurface;
  /**
   * Scheme-URL path portion. `surface=oauth_callback` → `/auth/callback`,
   * `invite_token` → `/invite/<token>` (passed full from server component).
   * The bridge appends `search + hash` from the current `window.location`.
   */
  schemePath: string;
  /** Human-readable heading. */
  heading: string;
  /** Sub-line explaining what would happen next inside the app. */
  subtitle: string;
};

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? "#";
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? "#";

export function UniversalLinkBridge({ surface, schemePath, heading, subtitle }: Props) {
  const [hasAttemptedRelay, setHasAttemptedRelay] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasAttemptedRelay) return;

    // Build scheme URL preserving query + hash. URL constructor validates
    // protocol — if `schemePath` is malformed we silently skip the relay
    // and render the fallback UI.
    let schemeUrl: string | null = null;
    try {
      const search = window.location.search ?? "";
      const hash = window.location.hash ?? "";
      schemeUrl = `smartout://${schemePath.replace(/^\//, "")}${search}${hash}`;
    } catch {
      schemeUrl = null;
    }

    let relay_attempted = false;
    if (schemeUrl) {
      relay_attempted = true;
      // Use `window.location.replace` so the bridge URL is replaced in history
      // — back button on the fallback page does NOT re-trigger the relay loop.
      window.location.replace(schemeUrl);
    }

    setHasAttemptedRelay(true);

    // Fire-and-forget telemetry — must not block the relay.
    void emit({
      event: "auth bridge_relayed",
      workspace_id: null,
      actor_id: nonEmpty("anonymous", "actor_id"),
      properties: { data: { surface, relay_attempted } },
    }).catch(() => {});
  }, [surface, schemePath, hasAttemptedRelay]);

  return (
    <div className="bg-background flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px] text-center">
        <Image
          src="/smartout-logo.png"
          alt="Smartout"
          width={120}
          height={42}
          className="mx-auto mb-8"
          priority
        />

        <div className="bg-muted/40 border-border/60 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border">
          <Smartphone className="text-brand-orange h-7 w-7" />
        </div>

        <h1 className="font-heading text-foreground text-[1.75rem] leading-[1.15] tracking-tight">
          {heading}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{subtitle}</p>

        <div className="mt-8 space-y-3">
          <Link
            href={APP_STORE_URL}
            className="border-border/60 bg-card hover:bg-muted/40 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Last ned for iOS
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={PLAY_STORE_URL}
            className="border-border/60 bg-card hover:bg-muted/40 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Last ned for Android
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <p className="border-border/60 text-muted-foreground mt-8 border-t pt-6 text-xs leading-relaxed">
          Har du allerede appen? Den åpner seg automatisk når du klikker lenken på telefonen din.
        </p>
      </div>
    </div>
  );
}
