import { createClient } from "@smartout/supabase/server";
import { emit, nonEmpty } from "@smartout/telemetry";
import { NextResponse } from "next/server";

/**
 * Slugs are URL-safe identifiers — reject anything that could break out of the
 * `https://<slug>.smartout.ai/...` template. Matches the workspace.slug
 * constraint (lowercase letters, digits, hyphen).
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const continueSlug = searchParams.get("continue");
  // Prevent open redirect — only allow relative paths
  const next = rawNext.startsWith("/") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Emit signup completed event
        try {
          await emit({
            event: "signup completed",
            workspace_id: null,
            actor_id: nonEmpty(user.id, "actor_id"),
            properties: {
              data: {
                user_identity_id: user.id,
              },
            },
          });
        } catch (e) {
          console.error("[auth/callback] Failed to emit signup.completed:", e);
        }

        // Check if user already has a profile (existing user with workspace)
        const { data: profiles } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", user.id)
          .limit(1);

        if (profiles && profiles.length > 0) {
          // Existing user with workspace — prefer continue-slug if validated,
          // else use the (relative) `next` path on the portal origin.
          const cont = await resolveContinueDestination(supabase, user.id, continueSlug, next);
          if (cont) return NextResponse.redirect(cont.url);
          return NextResponse.redirect(new URL(next || "/dashboard", origin));
        }

        // Check signup progress for resume
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

        // New user — wizard (resume at saved step if any)
        const step = progress?.current_step || 1;
        return NextResponse.redirect(new URL(`/join?step=${step}`, origin));
      }

      // User object missing but session exchange succeeded — fallback
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(new URL("/login?error=Invalid_link", origin));
}
