import { UniversalLinkBridge } from "../../_components/UniversalLinkBridge";

/**
 * `/m/auth/callback` — Universal-Link landing for mobile OAuth (Google).
 *
 * Mobile `signInWithOAuth({redirectTo: "https://app.smartout.ai/m/auth/callback"})`.
 * iOS/Android Universal Link intercept opens app at `(auth)/callback.tsx`
 * native screen if installed. Bridge below renders only when intercept fails
 * (desktop browser / app not installed).
 *
 * The actual token exchange (`exchangeCodeForSession`) happens INSIDE the app
 * — PKCE verifier is in SecureStore, not in any web cookie jar.
 */
export default function MobileAuthCallbackPage() {
  return (
    <UniversalLinkBridge
      surface="oauth_callback"
      schemePath="/auth/callback"
      heading="Fullfør innloggingen i appen"
      subtitle="Hvis Smartout-appen er installert, åpner den seg automatisk og du blir logget inn der."
    />
  );
}
