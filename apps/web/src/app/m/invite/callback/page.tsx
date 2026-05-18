import { UniversalLinkBridge } from "../../_components/UniversalLinkBridge";

/**
 * `/m/invite/callback` — Universal-Link landing for invite-Google flow on mobile.
 *
 * Mobile invite-accept screen calls `signInWithOAuth({
 *   redirectTo: "https://app.smartout.ai/m/invite/callback?token=<token>"
 * })`. Google → Supabase → here. Universal Link intercept opens app; bridge
 * renders only as fallback.
 *
 * The `token` query param is preserved into the scheme URL so the app's
 * native callback knows which invitation to accept.
 */
export default function MobileInviteCallbackPage() {
  return (
    <UniversalLinkBridge
      surface="invite_callback"
      schemePath="/invite/callback"
      heading="Aksjons invitasjonen i appen"
      subtitle="Smartout-appen åpner og fullfører invitasjonen automatisk hvis du har den installert."
    />
  );
}
