import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@smartout/supabase/server";
import { UniversalLinkBridge } from "../_components/UniversalLinkBridge";
import { MobileUpdatePasswordForm } from "./_components/MobileUpdatePasswordForm";

/**
 * `/m/update-password` — Universal-Link landing for password recovery on mobile.
 *
 * Two entry paths are handled here:
 *
 * PATH A — token_hash present (new flow, ADR-0389 extension):
 *   Mobile recovery email now uses template-variable `{{ .TokenHash }}` which
 *   places `?token_hash=<hash>&type=recovery` in the query string. When the
 *   Universal Link does NOT open the app (desktop browser, phone without app
 *   installed), this server page verifies the token server-side via
 *   `supabase.auth.verifyOtp({ token_hash, type: "recovery" })` — exactly
 *   mirroring how /api/auth/callback/route.ts handles the same token_hash
 *   pattern (ALLOWED_OTP_TYPES guard, createClient() from @smartout/supabase/server,
 *   redirect to /login?error=Invalid_link on failure). On success the session
 *   cookie is set and we render MobileUpdatePasswordForm for the client-side
 *   password update.
 *
 * PATH B — no token_hash (legacy / app-installed relay):
 *   Original Universal-Link flow. The OS intercepts the URL before this page
 *   renders; if it doesn't (user clicked on desktop, webview, etc.) we render
 *   UniversalLinkBridge with App Store CTAs + smartout:// scheme relay.
 *   Behaviour is UNCHANGED from the original page.
 *
 * Security note: no `next` redirect param is accepted — there is no
 * validateReturnTo call needed here because after a successful reset the
 * destination is always /select-workspace (hardcoded in the form component),
 * avoiding any open-redirect risk.
 */

/**
 * Token types we accept for password recovery via token_hash.
 * Mirrors the ALLOWED_OTP_TYPES guard in /api/auth/callback/route.ts.
 * Only "recovery" is relevant for this surface, but we validate strictly
 * so a forged ?type= never reaches verifyOtp.
 */
const ALLOWED_RECOVERY_TYPES = new Set<EmailOtpType>(["recovery"]);

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MobileUpdatePasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : null;
  const otpType = typeof params.type === "string" ? params.type : null;

  // PATH A: token_hash present + type=recovery — verify server-side.
  if (tokenHash && otpType && ALLOWED_RECOVERY_TYPES.has(otpType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });

    if (error) {
      // Invalid / expired / already-used token — same redirect as callback route.
      redirect("/login?error=Invalid_link");
    }

    // Session cookie is now set. Render the password form — the client component
    // will call updateUser() from an authenticated session.
    return <MobileUpdatePasswordForm />;
  }

  // PATH B: no token_hash — keep the existing Universal-Link bridge behaviour
  // unchanged. App-installed users never see this; desktop/webview users get
  // App Store CTAs and a smartout:// scheme relay attempt.
  return (
    <UniversalLinkBridge
      surface="update_password"
      schemePath="/update-password"
      heading="Sett nytt passord i appen"
      subtitle="Lenken åpner Smartout-appen så du kan velge et nytt passord. Den kan også brukes i nettleseren hvis du ikke har appen."
    />
  );
}
