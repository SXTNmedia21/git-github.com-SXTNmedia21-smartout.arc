import { UniversalLinkBridge } from "../_components/UniversalLinkBridge";

/**
 * `/m/confirm-email` — Universal-Link landing for email-confirmation on mobile.
 *
 * Supabase Auth → Email Templates → "Confirm signup" template can route to
 * `{{ .SiteURL }}/m/confirm-email` for the mobile variant. Universal Link
 * intercept → app `(auth)/confirm-email.tsx` (P2 — to be created in a
 * follow-up alongside this bridge).
 *
 * Fallback path: desktop browser → bridge renders → user can either install
 * app or continue on portal (web `/confirm-email` route consumes the same
 * hash and confirms web-side).
 */
export default function MobileConfirmEmailPage() {
  return (
    <UniversalLinkBridge
      surface="confirm_email"
      schemePath="/confirm-email"
      heading="Bekreft e-posten i appen"
      subtitle="Bekreftelseslenken åpner appen og fullfører verifiseringen automatisk."
    />
  );
}
