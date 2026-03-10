import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
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
        // Check if user already has a profile (existing user with workspace)
        const { data: profiles } = await supabase
          .from("profile")
          .select("profile_id")
          .eq("user_id", user.id)
          .limit(1);

        if (profiles && profiles.length > 0) {
          // Existing user with workspace — go to dashboard
          try {
            await emit({
              event: "auth callback completed",
              workspace_id: null,
              actor_id: user.id,
              properties: {
                data: {
                  user_identity_id: user.id,
                  is_existing_user: true,
                },
              },
            });
          } catch (e) {
            console.error("[auth/callback] Failed to emit:", e);
          }
          return NextResponse.redirect(new URL(next || "/dashboard", origin));
        }

        // Check signup progress for resume
        const { data: progress } = await supabase
          .from("signup_progress")
          .select("completed, current_step")
          .eq("auth_id", user.id)
          .single();

        if (progress?.completed) {
          return NextResponse.redirect(new URL(next || "/dashboard", origin));
        }

        // New user — wizard (resume at saved step if any)
        try {
          await emit({
            event: "signup callback routed",
            workspace_id: null,
            actor_id: user.id,
            properties: {
              data: {
                user_identity_id: user.id,
                resume_step: progress?.current_step || 1,
              },
            },
          });
        } catch (e) {
          console.error("[auth/callback] Failed to emit:", e);
        }
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
