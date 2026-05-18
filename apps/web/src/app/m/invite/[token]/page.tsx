import { UniversalLinkBridge } from "../../_components/UniversalLinkBridge";

/**
 * `/m/invite/<token>` — Universal-Link landing for QR-scanned / shared
 * invitation links.
 *
 * Per ADR-0021 amendment, the canonical invite URL is on the portal
 * (`app.smartout.ai/invite/<token>`). Mobile QR codes can choose to either:
 *   (a) embed the portal URL → web invite flow, mobile app opens iff
 *       installed via Universal Link on the portal path (handled by separate
 *       `/invite/<token>` route — proxy.ts redirects workspace, portal renders
 *       directly), OR
 *   (b) embed `/m/invite/<token>` → mobile-first Universal Link with this
 *       bridge as fallback.
 *
 * This route is for (b). The bridge attempts `smartout://invite/<token>`;
 * if app present, native invite screen handles. Otherwise the user sees
 * the fallback HTML and can either install the app or follow the link
 * "Fortsett i nettleser" to the portal invite flow.
 *
 * Token sanitization: this route is publicly reachable. The token itself is
 * a credential per ADR-0167. We do NOT log or emit it — bridge UniversalLink
 * component only relays via `window.location.search/hash`, and `surface`
 * + `relay_attempted` are the only emit payload (no token in registry).
 */
export default async function MobileInviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <UniversalLinkBridge
      surface="invite_token"
      schemePath={`/invite/${encodeURIComponent(token)}`}
      heading="Åpne invitasjonen i appen"
      subtitle="Du fikk en invitasjon til en arbeidsplass på Smartout. Appen viser hva du er invitert til."
    />
  );
}
