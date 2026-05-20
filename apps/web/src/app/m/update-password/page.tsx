import { UniversalLinkBridge } from "../_components/UniversalLinkBridge";

/**
 * `/m/update-password` — Universal-Link landing for password recovery on mobile.
 *
 * Mobile `resetPasswordForEmail(email, {redirectTo:
 *   "https://app.smartout.ai/m/update-password"
 * })`. Supabase emails recovery link with `#access_token=...&type=recovery`
 * hash. Click on phone → Universal Link → app `(auth)/update-password.tsx`
 * native screen.
 *
 * Bridge fallback path: user clicks recovery link on desktop or without app.
 * The scheme-URL relay attempts `smartout://update-password#hash`. If app
 * absent, fallback HTML offers App Store + a "Continue in browser" link
 * pointing to the portal `/update-password` (which can also consume the
 * hash and complete the reset web-side).
 *
 * The recovery hash is short-lived (~1h per Supabase default) — bridge
 * doesn't validate it server-side; the consuming screen (app or portal) does.
 */
export default function MobileUpdatePasswordPage() {
  return (
    <UniversalLinkBridge
      surface="update_password"
      schemePath="/update-password"
      heading="Sett nytt passord i appen"
      subtitle="Lenken åpner Smartout-appen så du kan velge et nytt passord. Den kan også brukes i nettleseren hvis du ikke har appen."
    />
  );
}
