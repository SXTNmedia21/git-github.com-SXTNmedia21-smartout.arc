import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validateReturnTo } from "@/lib/safe-redirect";

/**
 * Scrub orphan Supabase auth-token cookies before exchanging a fresh code.
 *
 * Background: prior to commit 5ad6dfde2 (NEXT_PUBLIC_ROOT_DOMAIN assert),
 * @supabase/ssr cookies were written without an explicit `domain` attribute,
 * so the browser scoped them to the exact host (`app.smartout.ai`). After
 * the change, fresh cookies arrive scoped to `.smartout.ai`. Browsers keep
 * BOTH variants when they have different `Domain` attributes, even when the
 * name matches — RFC 6265 §5.4. The server receives both Cookie values for
 * the same name; `@supabase/ssr` parses whichever the framework hands it
 * first. If that happens to be the stale variant, `getUser()` returns
 * "Refresh Token Not Found" → middleware nukes the freshly-set cookie →
 * user lands on /login despite a valid gotrue session.
 *
 * Mitigation: before `exchangeCodeForSession` writes new cookies, emit
 * delete instructions for EVERY token cookie under BOTH potential domain
 * variants. The PKCE code-verifier is preserved (the exchange needs it).
 *
 * Long-term: once all production sessions have rotated past 2026-05-20,
 * the orphan-host cookies will have aged out and this scrub becomes a
 * no-op. Keep it — costs nothing, hardens against future domain rewrites.
 */
async function scrubOrphanAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const allowDomain = rootDomain && rootDomain !== "localhost" ? `.${rootDomain}` : null;

  for (const c of cookieStore.getAll()) {
    if (!c.name.startsWith("sb-")) continue;
    // Preserve the PKCE code-verifier — exchangeCodeForSession reads it.
    if (c.name.endsWith("-code-verifier")) continue;
    // Bare-host variant (legacy)
    cookieStore.set(c.name, "", { maxAge: 0, path: "/" });
    // Leading-dot variant (current)
    if (allowDomain) {
      cookieStore.set(c.name, "", { maxAge: 0, path: "/", domain: allowDomain });
    }
  }
}

/**
 * Slugs are URL-safe identifiers — reject anything that could break out of the
 * `https://<slug>.smartout.ai/...` template. Matches the workspace.slug
 * constraint (lowercase letters, digits, hyphen).
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * token_hash verification types we accept on the callback. Mirrors GoTrue's
 * EmailOtpType. Anything outside this allow-list is rejected — a forged
 * `?type=` must never reach verifyOtp.
 */
const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "recovery",
  "magiclink",
  "signup",
  "invite",
  "email_change",
]);

/**
 * Resolve the post-auth destination.
 *
 * Per ADR-0021 amendment 2026-04-20 (Auth & Invitation Council Q1=b), all auth
 * surfaces live on `app.smartout.ai`. When the user originated from a workspace
 * subdomain (`{slug}.smartout.ai`), `proxy.ts` 307-redirected them here with
 * `?continue=<slug>`. After a successful session exchange, hop them back to the
 * workspace dashboard — but ONLY if they actually have a profile in that
 * workspace, otherwise `continue` is a free open-redirect.
 *
 * Returns an absolute URL when continuing to a workspace subdomain, otherwise a
 * relative path the caller resolves against the request origin (portal).
 */
async function resolveContinueDestination(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  continueSlug: string | null,
  nextPath: string,
): Promise<{ url: string; isAbsolute: boolean } | null> {
  if (!continueSlug || !SLUG_PATTERN.test(continueSlug)) return null;

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain || rootDomain === "localhost") return null;

  // Confirm the user has profile access to the requested workspace slug.
  // Without this, `?continue=victim-workspace` would let any logged-in user
  // bounce to a workspace they don't belong to (slug enumeration / phishing).
  const { data: workspace } = await supabase
    .from("workspace")
    .select("workspace_id, slug")
    .eq("slug", continueSlug)
    .maybeSingle();
  if (!workspace) return null;

  const { data: profile } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("workspace_id", workspace.workspace_id)
    .maybeSingle();
  if (!profile) return null;

  return {
    url: `https://${continueSlug}.${rootDomain}${nextPath}`,
    isAbsolute: true,
  };
}

/**
 * Shared post-authentication routing. Reached once a session is established —
 * either by PKCE `exchangeCodeForSession` (OAuth) or `verifyOtp({token_hash})`
 * (email magic-link / recovery). Decides where the now-authenticated user lands:
 * recovery → /update-password, existing profile → dashboard/continue-slug,
 * mid-signup → /join at the saved step.
 *
 * @param method - "email" for token_hash path (OTP / magic-link), "google" for PKCE OAuth path.
 *   Forwarded to the `auth signed_up` event so PostHog can segment first-time signups by channel.
 */
async function routeAfterAuth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  origin: string,
  next: string,
  continueSlug: string | null,
  method: "email" | "google" = "email",
): Promise<NextResponse> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Session set but user unreadable — fall back to the requested next path.
  if (!user) return NextResponse.redirect(new URL(next, origin));

  // Password-recovery short-circuit: honour an explicit /update-password target
  // before profile/signup routing kicks in. The session cookie is already set,
  // so /update-password sees the user and renders the set-password form.
  if (next === "/update-password" || next.startsWith("/update-password?")) {
    return NextResponse.redirect(new URL(next, origin));
  }

  try {
    await emit({
      event: "signup completed",
      workspace_id: null,
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: { data: { user_identity_id: user.id } },
    });
  } catch (e) {
    console.error("[auth/callback] Failed to emit signup.completed:", e);
  }

  // Existing user with a workspace profile → dashboard (or validated continue-slug).
  const { data: profiles } = await supabase
    .from("profile")
    .select("profile_id")
    .eq("user_id", user.id)
    .limit(1);

  if (profiles && profiles.length > 0) {
    const cont = await resolveContinueDestination(supabase, user.id, continueSlug, next);
    if (cont) return NextResponse.redirect(cont.url);
    return NextResponse.redirect(new URL(next || "/dashboard", origin));
  }

  // No profile yet — this is a brand-new user entering the signup wizard.
  // Emit auth signed_up (phantom-close L-0287). workspace_id is null (no workspace
  // exists yet at this point); actor_id is the GoTrue user UUID. ADR-0134 allows
  // null workspace_id for pre-workspace auth events.
  try {
    await emit({
      event: "auth signed_up",
      workspace_id: null,
      actor_id: nonEmpty(user.id, "actor_id"),
      properties: { method },
    });
  } catch (e) {
    console.error("[auth/callback] Failed to emit auth signed_up:", e);
  }

  // Resume the signup wizard at the saved step.
  const { data: progress, error: progressError } = await supabase
    .from("signup_progress")
    .select("completed, current_step")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (progressError) {
    return NextResponse.redirect(new URL("/join?step=1", origin));
  }

  if (progress?.completed) {
    const cont = await resolveContinueDestination(supabase, user.id, continueSlug, next);
    if (cont) return NextResponse.redirect(cont.url);
    return NextResponse.redirect(new URL(next || "/dashboard", origin));
  }

  const step = progress?.current_step || 1;
  return NextResponse.redirect(new URL(`/join?step=${step}`, origin));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const continueSlug = searchParams.get("continue");
  // Prevent open redirect. A bare `startsWith("/")` check is insufficient:
  // `//evil.com` and `/\evil.com` pass it but `new URL(next, origin)` resolves
  // them to an external host (protocol-relative authority). validateReturnTo
  // rejects `//`, `://`, and backslash — the same guard /login already uses.
  const next = validateReturnTo(rawNext) ?? "/dashboard";

  // ── Path A: token_hash (email magic-link / recovery, robust SSR flow) ──
  // GoTrue mints a hashed token rendered in the email as {{ .TokenHash }}; the
  // template links straight here. verifyOtp validates it SERVER-SIDE and writes
  // the session cookies — no PKCE code_verifier cookie required, so it works
  // across email clients and devices (unlike the ?code= path below). This is
  // why magic-link/recovery emails point here with token_hash, not ?code.
  if (tokenHash && otpType && ALLOWED_OTP_TYPES.has(otpType as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as EmailOtpType,
    });
    if (!error) {
      return routeAfterAuth(supabase, origin, next, continueSlug, "email");
    }
    // Invalid/expired/stale token_hash → send back to login with a clear marker.
    return NextResponse.redirect(new URL("/login?error=Invalid_link", origin));
  }

  // ── Path B: PKCE ?code= (OAuth providers — Google) ──
  if (code) {
    // Clear orphan token cookies (see scrubOrphanAuthCookies). MUST run
    // before createClient() so the fresh exchange writes into a clean slot.
    await scrubOrphanAuthCookies();

    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return routeAfterAuth(supabase, origin, next, continueSlug, "google");
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL("/login?error=Invalid_link", origin));
}
