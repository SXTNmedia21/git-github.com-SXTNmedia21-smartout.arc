import { createClient } from "@smartout/supabase/server";
import { emit } from "@smartout/telemetry";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get user identity for event emission
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          await emit({
            event: "signup completed",
            workspace_id: null,
            actor_id: user.id,
            properties: {
              data: {
                user_identity_id: user.id,
              },
            },
          });
        } catch (e) {
          console.error("[auth/callback] Failed to emit signup.completed:", e);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Invalid_link`);
}
